/**
 * Simulate an anxious GED student after 10 practice tests (~68% avg)
 * and verify adaptive form mix + weakness boost across many new forms.
 */
import { buildTopicAnalytics } from "../src/lib/analytics";
import type { TopicItemRow } from "../src/lib/db";
import { answersMatch } from "../src/lib/scoring";
import {
  BASE_TEMPLATE_CAP,
  WEAK_TOPIC_CAP,
  WEAKNESS_ATTEMPT_THRESHOLD,
  buildMathForm,
  countDomainsInForm,
  countTemplatesInForm,
} from "../src/data/templates/buildForm";
import { mulberry32 } from "../src/data/templates/types";

const ATTEMPTS = 10;
const NEW_FORMS = 15;

/**
 * Anxious starter ~68% overall:
 * clear struggles in algebra / graphs / angles;
 * stronger on basic number sense.
 */
const TOPIC_TRUE_SKILL: Record<string, number> = {
  algebra: 0.58,
  graphs: 0.55,
  functions: 0.68,
  inequalities: 0.6,
  roots: 0.57,
  angles: 0.62,
  geometry: 0.78,
  "surface-area": 0.76,
  fractions: 0.86,
  integers: 0.88,
  percent: 0.8,
  ratios: 0.82,
  rates: 0.8,
  data: 0.79,
  probability: 0.78,
  roots: 0.83,
  exponents: 0.82,
  finance: 0.84,
  "scientific-notation": 0.85,
};

function skillFor(topic: string): number {
  return TOPIC_TRUE_SKILL[topic] ?? 0.7;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function simulateHistory(seed: number): {
  rows: TopicItemRow[];
  attemptScores: number[];
  templateUsage: Map<string, number>;
} {
  const rng = mulberry32(seed);
  const rows: TopicItemRow[] = [];
  const attemptScores: number[] = [];
  const templateUsage = new Map<string, number>();

  for (let a = 0; a < ATTEMPTS; a += 1) {
    const form = buildMathForm({
      seed: seed + a * 997,
      attemptCount: a,
      templateUsage: new Map(templateUsage),
    });

    let correct = 0;
    form.questions.forEach((q, qi) => {
      templateUsage.set(q.templateId, (templateUsage.get(q.templateId) ?? 0) + 1);
      // slight anxiety: underperform skill a bit
      const p = Math.max(0.15, skillFor(q.topic ?? "") - 0.04);
      const hit = rng() < p;
      if (hit) correct += 1;
      rows.push({
        attempt_id: `attempt-${a + 1}`,
        submitted_at: new Date(Date.now() - (ATTEMPTS - a) * 86400000),
        question_id: `${q.id}-h${a}-${qi}`,
        topic: q.topic ?? "unknown",
        is_correct: hit,
      });
    });
    attemptScores.push(correct / form.questions.length);
  }

  return { rows, attemptScores, templateUsage };
}

function main() {
  const { rows, attemptScores, templateUsage } = simulateHistory(20260309);
  const analytics = buildTopicAnalytics(rows);
  const attemptCount = ATTEMPTS;
  const topicWeaknesses = analytics.map((t) => ({
    topic: t.topic,
    accuracy: t.accuracy,
    flagged: t.flagged,
  }));

  const flagged = analytics.filter((t) => t.flagged);
  // Focus report on primary struggle areas for this persona
  const focusWeak = ["algebra", "graphs", "angles", "roots", "inequalities"];

  console.log("=== Simulated student: anxious GED starter ===");
  console.log(
    `10 prior tests | mean ${(mean(attemptScores) * 100).toFixed(1)}% | per test: ${attemptScores
      .map((s) => `${Math.round(s * 100)}%`)
      .join(", ")}`
  );
  console.log(
    `Boost active: attemptCount ${attemptCount} >= ${WEAKNESS_ATTEMPT_THRESHOLD}`
  );
  console.log(
    "Top boost targets (worst 4 weak topics):",
    [...topicWeaknesses]
      .filter((t) => t.flagged || t.accuracy < 0.7)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4)
      .map((t) => `${t.topic} ${(t.accuracy * 100).toFixed(0)}%`)
      .join("; ")
  );


  const boostRates: Record<string, number[]> = {};
  const neutralRates: Record<string, number[]> = {};
  const boostDomains: { q: number; a: number; maxRep: number; unique: number }[] =
    [];
  const neutralDomains: typeof boostDomains = [];

  let sampleScore = 0;

  for (let i = 0; i < NEW_FORMS; i += 1) {
    const seed = 8000 + i * 17;
    const boosted = buildMathForm({
      seed,
      attemptCount,
      templateUsage,
      topicWeaknesses,
    });
    const neutral = buildMathForm({
      seed,
      attemptCount: 0,
      templateUsage,
    });

    const bd = countDomainsInForm(boosted.questions);
    const nd = countDomainsInForm(neutral.questions);
    boostDomains.push({
      q: bd.quantitative,
      a: bd.algebraic,
      maxRep: Math.max(...countTemplatesInForm(boosted.questions).values()),
      unique: countTemplatesInForm(boosted.questions).size,
    });
    neutralDomains.push({
      q: nd.quantitative,
      a: nd.algebraic,
      maxRep: Math.max(...countTemplatesInForm(neutral.questions).values()),
      unique: countTemplatesInForm(neutral.questions).size,
    });

    for (const topic of focusWeak) {
      (boostRates[topic] ??= []).push(
        boosted.questions.filter((q) => q.topic === topic).length / 46
      );
      (neutralRates[topic] ??= []).push(
        neutral.questions.filter((q) => q.topic === topic).length / 46
      );
    }

    if (i === 0) {
      const rng = mulberry32(424242);
      for (let qi = 0; qi < boosted.questions.length; qi += 1) {
        const q = boosted.questions[qi];
        const p = Math.max(0.15, skillFor(q.topic ?? "") - 0.04);
        const ans = rng() < p ? q.correctAnswer : "__miss__";
        if (answersMatch(ans, q.correctAnswer)) sampleScore += 1;
      }
      console.log(
        `\nNext test (form #1) simulated take: ${sampleScore}/46 (${(
          (sampleScore / 46) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        "Q1–5 (no calc):",
        boosted.questions
          .slice(0, 5)
          .map((q) => `${q.topic}`)
          .join(", ")
      );
    }
  }

  console.log(`\n=== Domain mix across ${NEW_FORMS} generated forms ===`);
  console.log(
    `Neutral: quant ${mean(neutralDomains.map((d) => d.q)).toFixed(1)} / alg ${mean(neutralDomains.map((d) => d.a)).toFixed(1)} | maxRep ${mean(neutralDomains.map((d) => d.maxRep)).toFixed(2)} (cap ${BASE_TEMPLATE_CAP}) | unique templates ${mean(neutralDomains.map((d) => d.unique)).toFixed(1)}`
  );
  console.log(
    `Boosted: quant ${mean(boostDomains.map((d) => d.q)).toFixed(1)} / alg ${mean(boostDomains.map((d) => d.a)).toFixed(1)} | maxRep ${mean(boostDomains.map((d) => d.maxRep)).toFixed(2)} (weak cap ${WEAK_TOPIC_CAP}) | unique templates ${mean(boostDomains.map((d) => d.unique)).toFixed(1)}`
  );

  console.log("\n=== Focus weaknesses: % of each new form (avg) ===");
  const table = focusWeak.map((topic) => {
    const n = mean(neutralRates[topic] ?? [0]);
    const b = mean(boostRates[topic] ?? [0]);
    return {
      topic,
      histAcc:
        `${((analytics.find((t) => t.topic === topic)?.accuracy ?? 0) * 100).toFixed(0)}%`,
      neutral: `${(n * 46).toFixed(1)} q`,
      boosted: `${(b * 46).toFixed(1)} q`,
      change: `${(b - n >= 0 ? "+" : "")}${((b - n) * 46).toFixed(1)} q`,
    };
  });
  console.table(table);

  const focusBoosted = table.filter((r) => parseFloat(r.change) > 0.3).length;
  const domainOk =
    Math.abs(mean(boostDomains.map((d) => d.q)) - 21) <= 1.5 &&
    Math.abs(mean(boostDomains.map((d) => d.a)) - 25) <= 1.5;
  const capOk = Math.max(...boostDomains.map((d) => d.maxRep)) <= WEAK_TOPIC_CAP;
  const avgOk = mean(attemptScores) >= 0.6 && mean(attemptScores) <= 0.76;

  console.log("\n=== Verdict ===");
  console.log(domainOk ? "PASS GED-like ~21/25 domain mix holds" : "FAIL domain mix");
  console.log(
    focusBoosted >= 3
      ? `PASS weakness boost increased ${focusBoosted}/5 focus weak topics`
      : `FAIL only ${focusBoosted}/5 focus topics increased`
  );
  console.log(capOk ? `PASS max template repeat ≤ ${WEAK_TOPIC_CAP}` : "FAIL over weak cap");
  console.log(
    avgOk
      ? `PASS history average in ~68% band (${(mean(attemptScores) * 100).toFixed(1)}%)`
      : `WARN history average ${(mean(attemptScores) * 100).toFixed(1)}%`
  );
}

main();
