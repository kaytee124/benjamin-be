import type { TopicItemRow } from "./db";

/** Min distinct tests covering a topic before it can be flagged. */
export const FLAG_MIN_COVERING_TESTS = 5;
/** Min total missed items (all history) before a topic can be flagged. */
export const FLAG_MIN_MISSES = 5;
/** Overall accuracy below this (with eligibility) triggers Rule A. */
export const FLAG_ACCURACY_THRESHOLD = 0.7;
/** Window of recent covering tests used for Rule B weak sittings. */
export const FLAG_WEAK_SITTING_WINDOW = 5;
/** Weak sittings required in that window to trigger Rule B. */
export const FLAG_MIN_WEAK_SITTINGS = 5;
/** For sittings with ≥3 topic items, miss rate must be at least this. */
export const FLAG_MULTI_ITEM_MISS_RATE = 0.5;

export interface TopicAnalytics {
  topic: string;
  itemsAttempted: number;
  itemsCorrect: number;
  accuracy: number;
  recentAccuracy: number | null;
  recentAttemptsConsidered: number;
  coveringAttempts: number;
  totalMisses: number;
  weakSittingCount: number;
  flagged: boolean;
  flagReasons: string[];
  recentMissedQuestionIds: string[];
}

/**
 * Whether one test sitting is "weak" for this topic, density-aware:
 * - 1 item: miss that item
 * - 2 items: miss both
 * - ≥3 items: miss rate ≥ 50%
 */
export function isWeakSitting(attemptItems: TopicItemRow[]): boolean {
  const n = attemptItems.length;
  if (n === 0) return false;
  const misses = attemptItems.filter((i) => !i.is_correct).length;
  if (n === 1) return misses === 1;
  if (n === 2) return misses === 2;
  return misses / n >= FLAG_MULTI_ITEM_MISS_RATE;
}

/**
 * Flag rules (both require eligibility: ≥5 covering tests AND ≥5 misses):
 * - Rule A: overall accuracy < 70%
 * - Rule B: ≥5 weak sittings in the last 5 covering tests (density-aware)
 */
export function buildTopicAnalytics(rows: TopicItemRow[]): TopicAnalytics[] {
  const byTopic = new Map<string, TopicItemRow[]>();
  for (const row of rows) {
    const list = byTopic.get(row.topic) ?? [];
    list.push(row);
    byTopic.set(row.topic, list);
  }

  const analytics: TopicAnalytics[] = [];

  for (const [topic, items] of byTopic) {
    const itemsAttempted = items.length;
    const itemsCorrect = items.filter((i) => i.is_correct).length;
    const totalMisses = itemsAttempted - itemsCorrect;
    const accuracy = itemsAttempted === 0 ? 0 : itemsCorrect / itemsAttempted;

    // Group by attempt (most recent first — rows already ordered DESC)
    const attemptOrder: string[] = [];
    const byAttempt = new Map<string, TopicItemRow[]>();
    for (const item of items) {
      if (!byAttempt.has(item.attempt_id)) {
        attemptOrder.push(item.attempt_id);
        byAttempt.set(item.attempt_id, []);
      }
      byAttempt.get(item.attempt_id)!.push(item);
    }

    const coveringAttempts = attemptOrder.length;
    const windowIds = attemptOrder.slice(0, FLAG_WEAK_SITTING_WINDOW);

    let weakSittingCount = 0;
    let recentItemCorrect = 0;
    let recentItemTotal = 0;
    const recentMissedQuestionIds: string[] = [];

    for (const attemptId of windowIds) {
      const attemptItems = byAttempt.get(attemptId) ?? [];
      if (isWeakSitting(attemptItems)) weakSittingCount += 1;
      recentItemTotal += attemptItems.length;
      recentItemCorrect += attemptItems.filter((i) => i.is_correct).length;
      for (const m of attemptItems.filter((i) => !i.is_correct)) {
        if (!recentMissedQuestionIds.includes(m.question_id)) {
          recentMissedQuestionIds.push(m.question_id);
        }
      }
    }

    // Also count weak sittings across all covering tests for display
    // (window count is what Rule B uses; expose window count as weakSittingCount)
    const recentAccuracy =
      recentItemTotal === 0 ? null : recentItemCorrect / recentItemTotal;

    const eligible =
      coveringAttempts >= FLAG_MIN_COVERING_TESTS &&
      totalMisses >= FLAG_MIN_MISSES;

    const flagReasons: string[] = [];
    if (eligible && accuracy < FLAG_ACCURACY_THRESHOLD) {
      flagReasons.push(
        `Overall accuracy ${(accuracy * 100).toFixed(0)}% across ${itemsAttempted} items on ${coveringAttempts} tests (< ${(FLAG_ACCURACY_THRESHOLD * 100).toFixed(0)}%; ≥${FLAG_MIN_COVERING_TESTS} tests & ≥${FLAG_MIN_MISSES} misses)`
      );
    }
    if (
      eligible &&
      windowIds.length >= FLAG_WEAK_SITTING_WINDOW &&
      weakSittingCount >= FLAG_MIN_WEAK_SITTINGS
    ) {
      flagReasons.push(
        `Weak sitting on ${weakSittingCount} of last ${windowIds.length} tests covering this topic (density-aware)`
      );
    }

    analytics.push({
      topic,
      itemsAttempted,
      itemsCorrect,
      accuracy: Math.round(accuracy * 1000) / 1000,
      recentAccuracy:
        recentAccuracy === null
          ? null
          : Math.round(recentAccuracy * 1000) / 1000,
      recentAttemptsConsidered: windowIds.length,
      coveringAttempts,
      totalMisses,
      weakSittingCount,
      flagged: flagReasons.length > 0,
      flagReasons,
      recentMissedQuestionIds,
    });
  }

  analytics.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return a.accuracy - b.accuracy;
  });

  return analytics;
}
