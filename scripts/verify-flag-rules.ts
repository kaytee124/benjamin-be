/**
 * Synthetic cases for density-aware topic flagging.
 * Run: npx tsx scripts/verify-flag-rules.ts
 */
import {
  buildTopicAnalytics,
  isWeakSitting,
} from "../src/lib/analytics";
import type { TopicItemRow } from "../src/lib/db";

function row(
  attempt: string,
  topic: string,
  qid: string,
  isCorrect: boolean,
  daysAgo: number
): TopicItemRow {
  return {
    attempt_id: attempt,
    submitted_at: new Date(Date.now() - daysAgo * 86400000),
    question_id: qid,
    topic,
    is_correct: isCorrect,
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

function main(): void {
  // isWeakSitting unit checks
  assert(
    isWeakSitting([row("a", "t", "1", false, 0)]),
    "1-item miss is weak"
  );
  assert(
    !isWeakSitting([row("a", "t", "1", true, 0)]),
    "1-item hit is not weak"
  );
  assert(
    isWeakSitting([
      row("a", "t", "1", false, 0),
      row("a", "t", "2", false, 0),
    ]),
    "2-item both miss is weak"
  );
  assert(
    !isWeakSitting([
      row("a", "t", "1", false, 0),
      row("a", "t", "2", true, 0),
    ]),
    "2-item one miss is not weak"
  );
  assert(
    isWeakSitting([
      row("a", "t", "1", false, 0),
      row("a", "t", "2", false, 0),
      row("a", "t", "3", true, 0),
      row("a", "t", "4", true, 0),
    ]),
    "4-item 50% miss is weak"
  );
  assert(
    !isWeakSitting([
      row("a", "t", "1", false, 0),
      row("a", "t", "2", true, 0),
      row("a", "t", "3", true, 0),
      row("a", "t", "4", true, 0),
    ]),
    "4-item 25% miss is not weak"
  );

  // Case 1: 2 tests × 1 miss → not flagged
  {
    const rows: TopicItemRow[] = [
      row("t1", "rare", "q1", false, 2),
      row("t2", "rare", "q2", false, 1),
    ];
    // newest first for analytics ordering expectation
    rows.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime());
    const a = buildTopicAnalytics(rows).find((t) => t.topic === "rare");
    assert(a != null && !a.flagged, "2 tests × 1 miss → not flagged");
  }

  // Case 2: 5 tests × 1 miss each (rare) → flagged Rule B (+ eligibility)
  {
    const rows: TopicItemRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      rows.push(row(`t${i}`, "rare", `q${i}`, false, 5 - i));
    }
    rows.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime());
    const a = buildTopicAnalytics(rows).find((t) => t.topic === "rare");
    assert(
      a != null && a.flagged && a.weakSittingCount === 5,
      "5×1 miss rare topic → flagged (Rule B)"
    );
  }

  // Case 3: 5 tests × miss 1 of 4 → 75% accuracy, not weak sittings → not flagged
  {
    const rows: TopicItemRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        rows.push(row(`t${i}`, "algebra", `q${i}-${j}`, j !== 0, 5 - i));
      }
    }
    rows.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime());
    const a = buildTopicAnalytics(rows).find((t) => t.topic === "algebra");
    assert(
      a != null && !a.flagged && a.accuracy === 0.75 && a.weakSittingCount === 0,
      "5× miss 1/4 algebra → not flagged"
    );
  }

  // Case 4: 5 tests × miss 2 of 4 → weak sittings = 5 → flagged
  {
    const rows: TopicItemRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        rows.push(row(`t${i}`, "algebra", `q${i}-${j}`, j >= 2, 5 - i));
      }
    }
    rows.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime());
    const a = buildTopicAnalytics(rows).find((t) => t.topic === "algebra");
    assert(
      a != null && a.flagged && a.weakSittingCount === 5,
      "5× miss 2/4 algebra → flagged"
    );
  }

  console.log("\nAll flag-rule checks passed.");
}

main();
