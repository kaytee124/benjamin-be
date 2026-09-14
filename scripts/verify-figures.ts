/**
 * Sanity check: SVG figure templates still generate and land on forms.
 * Run: npx tsx scripts/verify-figures.ts
 * Exit 1 on failure.
 */
import { buildMathForm } from "../src/data/templates/buildForm";
import { generateFromTemplate, getTemplates } from "../src/data/templates/catalog";
import { mulberry32 } from "../src/data/templates/types";

const FIGURE_TEMPLATE_IDS = [
  "pythagorean",
  "line-from-graph",
  "intercept-from-graph",
  "spinner-prob",
  "box-plot-read",
  "scatter-trend",
  "transversal-parallel",
  "similar-triangles",
] as const;

let failures = 0;

function fail(msg: string): void {
  console.error("FAIL:", msg);
  failures++;
}

const templates = getTemplates();
console.log("template count:", templates.length);

console.log("\nFigure template generates:");
const rng = mulberry32(99);
for (const id of FIGURE_TEMPLATE_IDS) {
  const t = templates.find((x) => x.id === id);
  if (!t) {
    fail(`${id}: template missing from catalog`);
    continue;
  }
  const g = generateFromTemplate(t, rng, true, 1);
  const svg = g.figureSvg ?? "";
  const ok = svg.trimStart().startsWith("<svg");
  if (!ok) {
    fail(`${id}: figureSvg missing or not SVG (len=${svg.length})`);
  } else {
    console.log(id, "SVG_OK", `len=${svg.length}`);
  }
}

console.log("\nSample forms (buildMathForm):");
let formsWithFigures = 0;
for (let i = 0; i < 5; i++) {
  const { questions } = buildMathForm({ seed: 5000 + i });
  const withFig = questions.filter(
    (q) => (q.figureSvg ?? "").trimStart().startsWith("<svg")
  );
  console.log(
    `form seed=${5000 + i}: ${withFig.length}/${questions.length} with figureSvg`
  );
  if (withFig.length > 0) formsWithFigures++;
}
if (formsWithFigures === 0) {
  fail("no sample form included any figureSvg");
} else {
  console.log(`forms with at least one figure: ${formsWithFigures}/5`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll figure checks passed.");
