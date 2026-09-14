import { randomUUID } from "crypto";
import { MATH_SUBJECT } from "../../lib/constants";
import { generateFromTemplate, getTemplates } from "./catalog";
import {
  domainForTopic,
  mulberry32,
  resolveDomain,
  type GeneratedQuestion,
  type MathDomain,
  type QuestionTemplate,
} from "./types";

export interface BuiltForm {
  questions: GeneratedQuestion[];
}

/** GED-aligned targets for a 46-item form (± slack allowed while filling). */
export const TARGET_QUANTITATIVE = 21;
export const TARGET_ALGEBRAIC = 25;

export const BASE_TEMPLATE_CAP = 3;
export const WEAK_TOPIC_CAP = 5;
export const ABSOLUTE_TEMPLATE_CAP = 6;
export const WEAKNESS_ATTEMPT_THRESHOLD = 8;

export interface TopicWeaknessInfo {
  topic: string;
  /** 0–1 accuracy; lower = weaker */
  accuracy: number;
  flagged: boolean;
}

export interface BuildMathFormOptions {
  seed?: number;
  seenFingerprints?: Set<string>;
  templateUsage?: Map<string, number>;
  /** Prior scored attempts; weakness boost applies at >= 8. */
  attemptCount?: number;
  topicWeaknesses?: TopicWeaknessInfo[];
}

/**
 * Build a 46-question form with GED-like ~45/55 domain mix,
 * rotation weights, and optional weakness boost after enough attempts.
 */
export function buildMathForm(options?: BuildMathFormOptions): BuiltForm {
  const seed = options?.seed ?? (Date.now() ^ (Math.random() * 1e9));
  const rng = mulberry32(seed >>> 0);
  const seen = options?.seenFingerprints ?? new Set<string>();
  const usage = options?.templateUsage ?? new Map<string, number>();
  const attemptCount = options?.attemptCount ?? 0;
  const weaknesses = options?.topicWeaknesses ?? [];

  const weakBoost = new Map<string, number>();
  if (attemptCount >= WEAKNESS_ATTEMPT_THRESHOLD) {
    // Only proven flags (stricter analytics) — no thin accuracy bypass.
    const ranked = [...weaknesses]
      .filter((w) => w.flagged)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4);

    for (const w of ranked) {
      const severity = 1 - Math.min(1, Math.max(0, w.accuracy));
      const mult = 2.5 + severity * 1.5;
      weakBoost.set(w.topic, mult);
    }
  }

  const templates = getTemplates();
  const noCalcPool = templates.filter((t) => t.allowNoCalc);
  const calcPool = templates.filter((t) => t.allowCalc);

  const noCalcCount = MATH_SUBJECT.noCalculatorCount;
  const total = MATH_SUBJECT.questionCount;
  const calcCount = total - noCalcCount;

  const questions: GeneratedQuestion[] = [];
  const usedFingerprints = new Set<string>();
  const formTemplateCounts = new Map<string, number>();
  let quantCount = 0;
  let algebraCount = 0;

  function templateCap(t: QuestionTemplate): number {
    const boost = weakBoost.get(t.topic);
    if (boost) return Math.min(ABSOLUTE_TEMPLATE_CAP, WEAK_TOPIC_CAP);
    return Math.min(ABSOLUTE_TEMPLATE_CAP, BASE_TEMPLATE_CAP);
  }

  function domainDeficit(domain: MathDomain): number {
    if (domain === "quantitative") {
      return TARGET_QUANTITATIVE - quantCount;
    }
    return TARGET_ALGEBRAIC - algebraCount;
  }

  function pickWeighted(
    pool: QuestionTemplate[],
    preferDomain: MathDomain | null,
    allowOverCap: boolean
  ): QuestionTemplate {
    let choices = pool.filter((t) => {
      const used = formTemplateCounts.get(t.id) ?? 0;
      if (allowOverCap) return used < ABSOLUTE_TEMPLATE_CAP;
      return used < templateCap(t);
    });
    if (choices.length === 0) choices = [...pool];

    if (preferDomain) {
      const domainChoices = choices.filter(
        (t) => resolveDomain(t) === preferDomain
      );
      if (domainChoices.length > 0) choices = domainChoices;
    }

    let totalWeight = 0;
    const weights = choices.map((t) => {
      const times = usage.get(t.id) ?? 0;
      let w = 1 / (1 + times);
      const boost = weakBoost.get(t.topic);
      if (boost) w *= boost;
      // Slight preference toward domain still needing slots
      if (preferDomain && resolveDomain(t) === preferDomain) w *= 1.15;
      totalWeight += w;
      return w;
    });

    let r = rng() * totalWeight;
    for (let i = 0; i < choices.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return choices[i];
    }
    return choices[choices.length - 1];
  }

  function preferredDomainForNextSlot(): MathDomain | null {
    const qNeed = domainDeficit("quantitative");
    const aNeed = domainDeficit("algebraic");
    const remaining = total - questions.length;
    if (remaining <= 0) return null;
    // If one domain is behind relative to remaining slots, prefer it
    if (qNeed > aNeed + 1) return "quantitative";
    if (aNeed > qNeed + 1) return "algebraic";
    // Mild random tilt toward whichever still needs more
    if (qNeed > 0 && aNeed > 0) {
      return rng() < qNeed / (qNeed + aNeed) ? "quantitative" : "algebraic";
    }
    if (qNeed > 0) return "quantitative";
    if (aNeed > 0) return "algebraic";
    return null;
  }

  function nextQuestion(
    pool: QuestionTemplate[],
    calculatorAllowed: boolean,
    position: number,
    forcePrefer: MathDomain | null
  ): GeneratedQuestion {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const allowOverCap = attempt >= 22;
      const prefer =
        forcePrefer ??
        (attempt < 15 ? preferredDomainForNextSlot() : null);
      const template = pickWeighted(pool, prefer, allowOverCap);
      const q = generateFromTemplate(
        template,
        rng,
        calculatorAllowed,
        position
      );
      if (usedFingerprints.has(q.fingerprint)) continue;
      if (seen.has(q.fingerprint) && attempt < 25) continue;

      usedFingerprints.add(q.fingerprint);
      formTemplateCounts.set(
        template.id,
        (formTemplateCounts.get(template.id) ?? 0) + 1
      );
      const domain = resolveDomain(template);
      if (domain === "quantitative") quantCount += 1;
      else algebraCount += 1;
      return q;
    }

    const template = pickWeighted(pool, null, true);
    const q = generateFromTemplate(template, rng, calculatorAllowed, position);
    q.id = `gen-${template.id}-${randomUUID().slice(0, 8)}-${position}`;
    usedFingerprints.add(q.fingerprint + "-" + position);
    formTemplateCounts.set(
      template.id,
      (formTemplateCounts.get(template.id) ?? 0) + 1
    );
    const domain = resolveDomain(template);
    if (domain === "quantitative") quantCount += 1;
    else algebraCount += 1;
    return q;
  }

  // No-calc block: prefer quantitative (number sense / arithmetic)
  for (let i = 0; i < noCalcCount; i += 1) {
    questions.push(
      nextQuestion(noCalcPool, false, i + 1, "quantitative")
    );
  }
  for (let i = 0; i < calcCount; i += 1) {
    questions.push(
      nextQuestion(calcPool, true, noCalcCount + i + 1, null)
    );
  }

  return { questions };
}

export function countTemplatesInForm(
  questions: GeneratedQuestion[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of questions) {
    counts.set(q.templateId, (counts.get(q.templateId) ?? 0) + 1);
  }
  return counts;
}

export function countDomainsInForm(questions: GeneratedQuestion[]): {
  quantitative: number;
  algebraic: number;
} {
  const templatesById = new Map(getTemplates().map((t) => [t.id, t]));
  let quantitative = 0;
  let algebraic = 0;
  for (const q of questions) {
    const t = templatesById.get(q.templateId);
    const domain = t ? resolveDomain(t) : domainFromQuestionTopic(q.topic);
    if (domain === "quantitative") quantitative += 1;
    else algebraic += 1;
  }
  return { quantitative, algebraic };
}

function domainFromQuestionTopic(topic?: string): MathDomain {
  if (!topic) return "quantitative";
  return domainForTopic(topic);
}
