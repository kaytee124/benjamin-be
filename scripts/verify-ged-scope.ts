/**
 * One-off sanity check: GED-level catalog guardrails.
 * Run: npx tsx scripts/verify-ged-scope.ts
 */
import { getTemplates, generateFromTemplate } from "../src/data/templates/catalog";
import { mulberry32 } from "../src/data/templates/types";

const templates = getTemplates();
const ids = templates.map((t) => t.id);

console.log("template count:", ids.length);
console.log("has compound-interest:", ids.includes("compound-interest"));
console.log("has simple-interest:", ids.includes("simple-interest"));

const q = templates.find((t) => t.id === "quadratic-roots-simple");
console.log("quadratic-roots-simple topic:", q?.topic);

const needFormula = [
  "sphere-volume",
  "cone-volume",
  "cylinder-volume",
  "cylinder-surface-area",
  "prism-surface-area",
  "cube-surface-area",
  "trapezoid-area",
];

const rng = mulberry32(42);
for (const id of needFormula) {
  const t = templates.find((x) => x.id === id);
  if (!t) {
    console.log(id, "MISSING_TEMPLATE");
    continue;
  }
  const g = generateFromTemplate(t, rng, true, 1);
  const ok = /SA =|V =|A =/.test(g.prompt);
  console.log(id, ok ? "FORMULA_OK" : "MISSING_FORMULA", "|", g.prompt.slice(0, 100));
}

console.log("\nFinance spot-checks:");
for (const t of templates.filter((x) => x.topic === "finance")) {
  const g = generateFromTemplate(t, rng, true, 1);
  console.log(t.id, "|", g.prompt.slice(0, 120));
}

console.log("\nBox-plot ask mix (n=40):");
const box = templates.find((t) => t.id === "box-plot-read")!;
let median = 0;
let iqr = 0;
for (let i = 0; i < 40; i++) {
  const g = generateFromTemplate(box, mulberry32(1000 + i), true, i);
  if (/median/i.test(g.prompt)) median++;
  else iqr++;
}
console.log({ median, iqr, medianPct: Math.round((100 * median) / 40) });

const banned = [/compound interest/i, /quadratic formula/i, /\blog\b/i, /sin\(|cos\(|tan\(/];
let bannedHits = 0;
for (const t of templates) {
  for (let i = 0; i < 3; i++) {
    const g = generateFromTemplate(t, mulberry32(t.id.length * 17 + i), true, i);
    for (const re of banned) {
      if (re.test(g.prompt) || re.test(g.explanation ?? "")) {
        console.log("BANNED HIT", t.id, re, g.prompt.slice(0, 80));
        bannedHits++;
      }
    }
  }
}
console.log("banned phrase hits:", bannedHits);
