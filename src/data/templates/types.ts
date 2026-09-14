import { createHash } from "crypto";
import type { Question } from "../../lib/types";

export type MathDomain = "quantitative" | "algebraic";

export interface GeneratedQuestion extends Question {
  templateId: string;
  fingerprint: string;
}

export interface QuestionTemplate {
  id: string;
  topic: string;
  /** GED content domain; defaults from topic via domainForTopic. */
  domain?: MathDomain;
  /** Whether this template is eligible for the no-calculator block. */
  allowNoCalc: boolean;
  /** Whether this template is eligible for the calculator-allowed block. */
  allowCalc: boolean;
  generate: (rng: () => number) => Omit<
    GeneratedQuestion,
    "id" | "subjectId" | "templateId" | "fingerprint" | "calculatorAllowed"
  > & { calculatorAllowed?: boolean };
}

/** Map practice topics to official GED ~45% quant / ~55% algebra domains. */
export function domainForTopic(topic: string): MathDomain {
  const algebraic = new Set([
    "algebra",
    "graphs",
    "functions",
    "inequalities",
  ]);
  // decimals, fractions, geometry, roots, data, etc. default to quantitative
  return algebraic.has(topic) ? "algebraic" : "quantitative";
}

export function resolveDomain(t: QuestionTemplate): MathDomain {
  return t.domain ?? domainForTopic(t.topic);
}

export function fingerprintOf(
  templateId: string,
  params: Record<string, string | number>
): string {
  const payload = JSON.stringify({
    templateId,
    params: Object.keys(params)
      .sort()
      .reduce<Record<string, string | number>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {}),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffleInPlace<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function uniqueOptions(
  rng: () => number,
  correct: string,
  distractors: string[]
): string[] {
  const set = new Set<string>([correct, ...distractors]);
  const opts = [...set];
  while (opts.length < 4) {
    opts.push(String(Number(correct) + randInt(rng, 1, 9)));
  }
  return shuffleInPlace(rng, opts.slice(0, 4));
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function simplifyFraction(n: number, d: number): [number, number] {
  const g = gcd(n, d);
  return [n / g, d / g];
}
