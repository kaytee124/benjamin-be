/**
 * Four distinct student personas × 15 tests each via createMathSession + persistAttempt.
 * Measures weakness-boost lift, cross-student isolation, and GED coverage (graphs + Pythagoras).
 *
 * Run: npm run sim:four
 * Optional: SIM_USE_DB=1 to also write sim-* rows to Postgres (default: memory-only).
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { buildTopicAnalytics } from "../src/lib/analytics";
import {
  clearMemoryAttempts,
  isDbConfigured,
  listTopicItems,
  persistAttempt,
} from "../src/lib/db";
import { practiceBandFromPercentage } from "../src/lib/scoring";
import {
  clearMemorySessions,
  createMathSession,
  getSession,
} from "../src/lib/sessions";
import {
  WEAK_TOPIC_CAP,
  WEAKNESS_ATTEMPT_THRESHOLD,
  buildMathForm,
  countDomainsInForm,
  countTemplatesInForm,
} from "../src/data/templates/buildForm";
import { getTemplates } from "../src/data/templates/catalog";
import type { GeneratedQuestion } from "../src/data/templates/types";
import { mulberry32 } from "../src/data/templates/types";

loadEnv();

const TESTS_PER_KID = 15;
const PRE_BOOST_TESTS = WEAKNESS_ATTEMPT_THRESHOLD; // 1..8
const LIFT_THRESHOLD_Q = 0.5;

interface Persona {
  id: string;
  label: string;
  plantedWeak: string[];
  /** Base P(correct); planted weak topics overridden lower. */
  skills: Record<string, number>;
  defaultSkill: number;
}

const BASE_SKILLS: Record<string, number> = {
  algebra: 0.78,
  graphs: 0.76,
  functions: 0.8,
  inequalities: 0.78,
  angles: 0.8,
  geometry: 0.82,
  "surface-area": 0.8,
  fractions: 0.88,
  integers: 0.9,
  percent: 0.85,
  ratios: 0.86,
  rates: 0.84,
  data: 0.82,
  probability: 0.82,
  roots: 0.84,
  exponents: 0.84,
  finance: 0.86,
  "scientific-notation": 0.86,
  decimals: 0.84,
};

function withWeak(
  planted: string[],
  weakSkill: number,
  overrides: Record<string, number> = {}
): Record<string, number> {
  const skills = { ...BASE_SKILLS, ...overrides };
  for (const t of planted) skills[t] = weakSkill;
  return skills;
}

const PERSONAS: Persona[] = [
  {
    id: "sim-alex",
    label: "Geometry / surface-area struggler",
    plantedWeak: ["surface-area", "geometry"],
    skills: withWeak(["surface-area", "geometry"], 0.42),
    defaultSkill: 0.8,
  },
  {
    id: "sim-blake",
    label: "Algebra / graphs struggler",
    plantedWeak: ["algebra", "graphs"],
    skills: withWeak(["algebra", "graphs"], 0.4, {
      functions: 0.55,
      inequalities: 0.52,
      roots: 0.5,
    }),
    defaultSkill: 0.8,
  },
  {
    id: "sim-casey",
    label: "Angles + right triangles",
    plantedWeak: ["angles", "geometry"],
    skills: withWeak(["angles", "geometry"], 0.44),
    defaultSkill: 0.82,
  },
  {
    id: "sim-drew",
    label: "Strong overall, mild data gap",
    plantedWeak: ["data"],
    skills: withWeak(["data"], 0.58, {
      algebra: 0.88,
      graphs: 0.86,
      geometry: 0.9,
      "surface-area": 0.88,
      angles: 0.88,
    }),
    defaultSkill: 0.9,
  },
];

interface FormSnap {
  testIndex: number; // 1-based
  attemptCountAtCreate: number;
  scorePct: number;
  topicCounts: Record<string, number>;
  templateCounts: Record<string, number>;
  graphsCount: number;
  pythagoreanCount: number;
  lineFromGraphCount: number;
  figuresCount: number;
  quantitative: number;
  algebraic: number;
  maxTemplateRep: number;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function skillFor(persona: Persona, topic: string): number {
  return persona.skills[topic] ?? persona.defaultSkill;
}

function topicCounts(questions: GeneratedQuestion[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of questions) {
    const t = q.topic ?? "unknown";
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function avgTopicQ(
  snaps: FormSnap[],
  topic: string
): number {
  if (snaps.length === 0) return 0;
  return mean(snaps.map((s) => s.topicCounts[topic] ?? 0));
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function runPersona(
  persona: Persona,
  baseSeed: number
): Promise<{ snaps: FormSnap[]; scores: number[] }> {
  const rng = mulberry32(baseSeed);
  const snaps: FormSnap[] = [];
  const scores: number[] = [];

  for (let t = 1; t <= TESTS_PER_KID; t += 1) {
    const t0 = Date.now();
    process.stdout.write(
      `  ${persona.id} test ${t}/${TESTS_PER_KID}… `
    );
    const { sessionId } = await createMathSession(persona.id);
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Missing session ${sessionId}`);

    const questions = session.questions;
    const attemptCountAtCreate = t - 1;

    let correct = 0;
    const review = questions.map((q) => {
      const p = Math.max(0.12, skillFor(persona, q.topic ?? "") - 0.03);
      const hit = rng() < p;
      if (hit) correct += 1;
      return {
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        studentAnswer: hit ? q.correctAnswer : "__miss__",
        correctAnswer: q.correctAnswer.split("|")[0].trim(),
        isCorrect: hit,
        explanation: q.explanation,
        topic: q.topic,
      };
    });

    const percentage =
      Math.round((correct / questions.length) * 1000) / 10;
    const practiceBand = practiceBandFromPercentage(percentage);

    await persistAttempt({
      studentId: persona.id,
      startedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      correct,
      total: questions.length,
      percentage,
      practiceBand,
      review,
    });

    console.log(`${percentage}% (${Date.now() - t0}ms)`);

    const templates = countTemplatesInForm(questions);
    const domains = countDomainsInForm(questions);
    const snap: FormSnap = {
      testIndex: t,
      attemptCountAtCreate,
      scorePct: percentage,
      topicCounts: topicCounts(questions),
      templateCounts: Object.fromEntries(templates),
      graphsCount: questions.filter((q) => q.topic === "graphs").length,
      pythagoreanCount: questions.filter((q) => q.templateId === "pythagorean")
        .length,
      lineFromGraphCount: questions.filter(
        (q) => q.templateId === "line-from-graph"
      ).length,
      figuresCount: questions.filter((q) => Boolean(q.figureSvg)).length,
      quantitative: domains.quantitative,
      algebraic: domains.algebraic,
      maxTemplateRep: Math.max(0, ...templates.values()),
    };
    snaps.push(snap);
    scores.push(percentage);
  }

  return { snaps, scores };
}

function topBoostTargets(
  analytics: ReturnType<typeof buildTopicAnalytics>
): string[] {
  return [...analytics]
    .filter((t) => t.flagged)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4)
    .map((t) => `${t.topic} ${(t.accuracy * 100).toFixed(0)}%`);
}

function catalogAudit(): {
  ok: boolean;
  topicCounts: Record<string, number>;
  hasGraphs: boolean;
  hasPythagorean: boolean;
  hasLineFromGraph: boolean;
  hasDecimals: boolean;
  hasVisualPythagoras: boolean;
  gaps: string[];
} {
  const templates = getTemplates();
  const topicCounts: Record<string, number> = {};
  let hasPythagorean = false;
  let hasLineFromGraph = false;
  let hasVisualPythagoras = false;
  for (const t of templates) {
    topicCounts[t.topic] = (topicCounts[t.topic] ?? 0) + 1;
    if (t.id === "pythagorean") {
      hasPythagorean = true;
      // Spot-check generator emits figureSvg
      const sample = t.generate(() => 0.42);
      hasVisualPythagoras = Boolean(sample.figureSvg);
    }
    if (t.id === "line-from-graph") hasLineFromGraph = true;
  }
  const hasGraphs = (topicCounts.graphs ?? 0) > 0;
  const hasDecimals = (topicCounts.decimals ?? 0) > 0;
  const gaps = [
    "No pixel/photo figure assets (SVG diagrams only — intentional)",
    "No cone surface-area / pyramid volume beyond cone volume",
    "No conditional probability beyond independent with-replacement",
    "Finance uses simple interest only (GED-typical; no compound)",
  ];
  return {
    ok: hasGraphs && hasPythagorean && hasLineFromGraph && hasDecimals,
    topicCounts,
    hasGraphs,
    hasPythagorean,
    hasLineFromGraph,
    hasDecimals,
    hasVisualPythagoras,
    gaps,
  };
}

async function main(): Promise<void> {
  if (process.env.SIM_USE_DB === "1" && isDbConfigured()) {
    console.warn(
      "SIM_USE_DB=1 — persisting sim-* attempts to Postgres (sessions stay in-memory for speed)."
    );
    process.env.SKIP_SESSION_PERSIST = "1";
  } else {
    delete process.env.DATABASE_URL;
    console.log(
      "Memory-only sim (set SIM_USE_DB=1 to also write attempts to Postgres).\n"
    );
  }

  clearMemoryAttempts();
  clearMemorySessions();

  const catalog = catalogAudit();
  console.log("=== Catalog audit ===");
  console.log(
    `Templates: ${getTemplates().length} | topics: ${Object.keys(catalog.topicCounts).length}`
  );
  console.log(
    `graphs: ${catalog.topicCounts.graphs ?? 0} | decimals: ${catalog.topicCounts.decimals ?? 0} | line-from-graph: ${catalog.hasLineFromGraph} | pythagorean+figure: ${catalog.hasVisualPythagoras}`
  );
  console.log("Topic counts:", catalog.topicCounts);

  const allSnaps: Record<string, FormSnap[]> = {};
  const allScores: Record<string, number[]> = {};
  const analyticsAfter8: Record<string, string[]> = {};
  const analyticsAfter15: Record<string, string[]> = {};

  for (const persona of PERSONAS) {
    console.log(`\n--- Running ${persona.id} (${persona.label}) — ${TESTS_PER_KID} tests ---`);
    const { snaps, scores } = await runPersona(
      persona,
      hashSeed(persona.id) ^ 0x4f15709
    );
    allSnaps[persona.id] = snaps;
    allScores[persona.id] = scores;

    const rowsAll = await listTopicItems(persona.id);
    analyticsAfter15[persona.id] = topBoostTargets(
      buildTopicAnalytics(rowsAll)
    );

    // Topic items are newest-first; chronological attempt ids = reverse unique order.
    const attemptIdsNewestFirst = [...new Set(rowsAll.map((r) => r.attempt_id))];
    const chronological = [...attemptIdsNewestFirst].reverse();
    const setFirst8 = new Set(chronological.slice(0, PRE_BOOST_TESTS));
    const rowsAt8 = rowsAll.filter((r) => setFirst8.has(r.attempt_id));
    analyticsAfter8[persona.id] = topBoostTargets(buildTopicAnalytics(rowsAt8));

    console.log(
      `  mean score ${mean(scores).toFixed(1)}% | after-8 boost targets: ${analyticsAfter8[persona.id].join("; ") || "(none)"}`
    );
  }

  // --- Persona summaries ---
  console.log("\n=== 1. Persona summaries ===");
  console.table(
    PERSONAS.map((p) => ({
      student: p.id,
      planted: p.plantedWeak.join(", "),
      meanPct: `${mean(allScores[p.id]).toFixed(1)}%`,
      tests: TESTS_PER_KID,
    }))
  );

  // --- Boost effectiveness ---
  console.log("\n=== 2. Boost effectiveness (Q/form planted topics) ===");
  const liftRows: {
    student: string;
    topic: string;
    pre: string;
    post: string;
    neutral: string;
    liftVsPre: string;
    liftVsNeutral: string;
    pass: string;
  }[] = [];
  const kidLiftPass: Record<string, boolean> = {};

  for (const persona of PERSONAS) {
    const snaps = allSnaps[persona.id];
    const pre = snaps.filter((s) => s.testIndex <= PRE_BOOST_TESTS);
    const post = snaps.filter((s) => s.testIndex > PRE_BOOST_TESTS);

    const rows = await listTopicItems(persona.id);
    const analytics = buildTopicAnalytics(rows);
    const topicWeaknesses = analytics.map((t) => ({
      topic: t.topic,
      accuracy: t.accuracy,
      flagged: t.flagged,
    }));

    let anyLift = false;
    for (const topic of persona.plantedWeak) {
      const preQ = avgTopicQ(pre, topic);
      const postQ = avgTopicQ(post, topic);
      const topicFlagged = analytics.find((t) => t.topic === topic)?.flagged === true;

      const neutralQs: number[] = [];
      for (let i = 0; i < post.length; i += 1) {
        const seed = hashSeed(persona.id) + 9000 + i * 17;
        const neutral = buildMathForm({
          seed,
          attemptCount: 0,
        });
        neutralQs.push(
          neutral.questions.filter((q) => q.topic === topic).length
        );
        // Matched-seed boosted counterfactual (analytics-driven, not session path)
        void buildMathForm({
          seed,
          attemptCount: TESTS_PER_KID,
          topicWeaknesses,
        });
      }
      const neutralQ = mean(neutralQs);
      const liftPre = postQ - preQ;
      const liftNeutral = postQ - neutralQ;
      const pass =
        liftPre >= LIFT_THRESHOLD_Q ||
        liftNeutral >= LIFT_THRESHOLD_Q ||
        topicFlagged;
      if (pass) anyLift = true;

      liftRows.push({
        student: persona.id,
        topic,
        pre: preQ.toFixed(2),
        post: postQ.toFixed(2),
        neutral: neutralQ.toFixed(2),
        liftVsPre: `${liftPre >= 0 ? "+" : ""}${liftPre.toFixed(2)}`,
        liftVsNeutral: `${liftNeutral >= 0 ? "+" : ""}${liftNeutral.toFixed(2)}`,
        pass: pass ? (topicFlagged && liftPre < LIFT_THRESHOLD_Q && liftNeutral < LIFT_THRESHOLD_Q ? "Y(flag)" : "Y") : "N",
      });
    }
    kidLiftPass[persona.id] = anyLift;
  }
  console.table(liftRows);

  console.log("\nTop-4 boost targets after test 8:");
  for (const p of PERSONAS) {
    console.log(`  ${p.id}: ${analyticsAfter8[p.id].join("; ") || "(none)"}`);
  }
  console.log("Top-4 boost targets after test 15:");
  for (const p of PERSONAS) {
    console.log(`  ${p.id}: ${analyticsAfter15[p.id].join("; ") || "(none)"}`);
  }

  // --- Isolation ---
  console.log("\n=== 3. Isolation (post-boost mean Q/form) ===");
  const isolationRows: Record<string, string>[] = [];
  const topicsOfInterest = [
    ...new Set(PERSONAS.flatMap((p) => p.plantedWeak)),
  ];
  for (const topic of topicsOfInterest) {
    const row: Record<string, string> = { topic };
    for (const p of PERSONAS) {
      const post = allSnaps[p.id].filter(
        (s) => s.testIndex > PRE_BOOST_TESTS
      );
      row[p.id] = avgTopicQ(post, topic).toFixed(2);
    }
    isolationRows.push(row);
  }
  console.table(isolationRows);

  // Each kid should, on average across planted topics, show higher (or near-equal)
  // post-boost density than non-planters. Domain-saturated topics (algebra/graphs)
  // get a wider tolerance because the ~25 algebraic slots keep baseline counts high.
  let isolationOk = true;
  for (const persona of PERSONAS) {
    const post = allSnaps[persona.id].filter(
      (s) => s.testIndex > PRE_BOOST_TESTS
    );
    const deltas: number[] = [];
    for (const topic of persona.plantedWeak) {
      const mine = avgTopicQ(post, topic);
      const others = PERSONAS.filter(
        (o) => o.id !== persona.id && !o.plantedWeak.includes(topic)
      );
      if (others.length === 0) {
        deltas.push(0);
        continue;
      }
      const otherMean = mean(
        others.map((o) =>
          avgTopicQ(
            allSnaps[o.id].filter((s) => s.testIndex > PRE_BOOST_TESTS),
            topic
          )
        )
      );
      deltas.push(mine - otherMean);
    }
    const avgDelta = mean(deltas);
    const tol = persona.plantedWeak.every(
      (t) => t === "algebra" || t === "graphs"
    )
      ? -0.75
      : -0.25;
    if (avgDelta < tol) isolationOk = false;
  }

  // --- Domain mix + caps ---
  console.log("\n=== 4. Domain mix + caps (all forms) ===");
  const allForms = PERSONAS.flatMap((p) => allSnaps[p.id]);
  const postForms = allForms.filter((s) => s.testIndex > PRE_BOOST_TESTS);
  const preForms = allForms.filter((s) => s.testIndex <= PRE_BOOST_TESTS);
  console.log(
    `All forms: quant ${mean(allForms.map((s) => s.quantitative)).toFixed(1)} / alg ${mean(allForms.map((s) => s.algebraic)).toFixed(1)}`
  );
  console.log(
    `Post-boost maxRep mean ${mean(postForms.map((s) => s.maxTemplateRep)).toFixed(2)} | hard observed max ${Math.max(...postForms.map((s) => s.maxTemplateRep))} (cap ${WEAK_TOPIC_CAP})`
  );
  const domainOk =
    Math.abs(mean(allForms.map((s) => s.quantitative)) - 21) <= 2 &&
    Math.abs(mean(allForms.map((s) => s.algebraic)) - 25) <= 2;
  const capOk =
    Math.max(...postForms.map((s) => s.maxTemplateRep)) <= WEAK_TOPIC_CAP;

  // Fresh path: tests 1..7 created with attemptCount < 8
  const freshOk = preForms
    .filter((s) => s.testIndex < WEAKNESS_ATTEMPT_THRESHOLD)
    .every((s) => s.attemptCountAtCreate < WEAKNESS_ATTEMPT_THRESHOLD);

  // --- Coverage empirical ---
  console.log("\n=== 5. Coverage: graphs + Pythagoras + figures ===");
  const formsWithGraphs = allForms.filter((s) => s.graphsCount > 0).length;
  const formsWithPythag = allForms.filter((s) => s.pythagoreanCount > 0).length;
  const formsWithLineGraph = allForms.filter(
    (s) => s.lineFromGraphCount > 0
  ).length;
  const formsWithFigure = allForms.filter((s) => s.figuresCount > 0).length;
  const graphsFormShare = formsWithGraphs / allForms.length;
  const pythagFormShare = formsWithPythag / allForms.length;
  const lineGraphShare = formsWithLineGraph / allForms.length;
  const figureShare = formsWithFigure / allForms.length;
  const topicHistogram: Record<string, number> = {};
  for (const s of allForms) {
    for (const [topic, n] of Object.entries(s.topicCounts)) {
      topicHistogram[topic] = (topicHistogram[topic] ?? 0) + n;
    }
  }
  console.log(
    `Forms with ≥1 graphs: ${formsWithGraphs}/${allForms.length} (${(graphsFormShare * 100).toFixed(1)}%)`
  );
  console.log(
    `Forms with ≥1 line-from-graph: ${formsWithLineGraph}/${allForms.length} (${(lineGraphShare * 100).toFixed(1)}%)`
  );
  console.log(
    `Forms with ≥1 pythagorean: ${formsWithPythag}/${allForms.length} (${(pythagFormShare * 100).toFixed(1)}%)`
  );
  console.log(
    `Forms with ≥1 figureSvg: ${formsWithFigure}/${allForms.length} (${(figureShare * 100).toFixed(1)}%)`
  );
  console.log(
    `Avg graphs Q/form: ${mean(allForms.map((s) => s.graphsCount)).toFixed(2)} | avg pythagorean Q/form: ${mean(allForms.map((s) => s.pythagoreanCount)).toFixed(2)} | avg figures Q/form: ${mean(allForms.map((s) => s.figuresCount)).toFixed(2)}`
  );
  console.log("Topic appearance (total items across all forms):");
  console.table(
    Object.entries(topicHistogram)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, items]) => ({
        topic,
        items,
        perForm: (items / allForms.length).toFixed(2),
      }))
  );

  console.log("\nRemaining GED coverage gaps (honest):");
  for (const g of catalog.gaps) console.log(`  - ${g}`);

  const graphsPass = catalog.hasGraphs && graphsFormShare >= 0.15;
  const pythagPass =
    catalog.hasPythagorean &&
    catalog.hasVisualPythagoras &&
    pythagFormShare >= 0.05;
  const visualGraphPass = catalog.hasLineFromGraph && lineGraphShare > 0;
  const figuresPass = figureShare >= 0.3;
  const decimalsPass = catalog.hasDecimals;
  const liftPass = PERSONAS.every((p) => kidLiftPass[p.id]);

  // --- Verdict ---
  console.log("\n=== 6. Verdict ===");
  console.log(
    liftPass
      ? "PASS each kid shows planted-topic lift or proven flag after 15 tests"
      : `FAIL lift/flag — failed: ${PERSONAS.filter((p) => !kidLiftPass[p.id])
          .map((p) => p.id)
          .join(", ")}`
  );
  console.log(
    isolationOk
      ? "PASS isolation — each kid leads (or near-leads) on planted topics vs non-planters"
      : "FAIL isolation — planted topics not differentiated across kids"
  );
  console.log(
    freshOk
      ? "PASS fresh path — tests 1–7 created with attemptCount < 8"
      : "FAIL fresh path attemptCount gate"
  );
  console.log(
    domainOk
      ? "PASS GED-like ~21/25 domain mix"
      : "FAIL domain mix drift"
  );
  console.log(
    capOk
      ? `PASS max template repeat ≤ ${WEAK_TOPIC_CAP} on post-boost forms`
      : "FAIL template cap exceeded"
  );
  console.log(
    graphsPass
      ? `PASS graphs coverage (catalog + ${(graphsFormShare * 100).toFixed(0)}% of forms)`
      : "FAIL graphs coverage"
  );
  console.log(
    visualGraphPass
      ? `PASS visual line-from-graph appears (${(lineGraphShare * 100).toFixed(0)}% of forms)`
      : "FAIL visual line-from-graph never appeared"
  );
  console.log(
    pythagPass
      ? `PASS Pythagoras with figure (${(pythagFormShare * 100).toFixed(0)}% of forms)`
      : "FAIL Pythagoras coverage / missing figure"
  );
  console.log(
    figuresPass
      ? `PASS figureSvg on ≥30% of forms (${(figureShare * 100).toFixed(0)}%)`
      : "FAIL too few figureSvg items"
  );
  console.log(
    decimalsPass ? "PASS decimals topic in catalog" : "FAIL decimals topic missing"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    testsPerKid: TESTS_PER_KID,
    personas: PERSONAS.map((p) => ({
      id: p.id,
      label: p.label,
      plantedWeak: p.plantedWeak,
      meanScore: mean(allScores[p.id]),
      boostAfter8: analyticsAfter8[p.id],
      boostAfter15: analyticsAfter15[p.id],
    })),
    liftRows,
    isolationRows,
    coverage: {
      catalog,
      graphsFormShare,
      pythagFormShare,
      lineGraphShare,
      figureShare,
      topicHistogram,
    },
    verdict: {
      liftPass,
      isolationOk,
      freshOk,
      domainOk,
      capOk,
      graphsPass,
      visualGraphPass,
      pythagPass,
      figuresPass,
      decimalsPass,
    },
  };

  const outDir = join(process.cwd(), "scripts", "output");
  try {
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "four-students-report.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${outPath}`);
  } catch (err) {
    console.warn("Could not write JSON report:", err);
  }

  const allPass =
    liftPass &&
    isolationOk &&
    freshOk &&
    domainOk &&
    capOk &&
    graphsPass &&
    visualGraphPass &&
    pythagPass &&
    figuresPass &&
    decimalsPass;
  if (!allPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
