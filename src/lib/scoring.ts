import type { PracticeBand } from "./types";

/** Normalize answers for comparison (trim, collapse spaces, lowercase). */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Compare student answer to correct answer.
 * Accepts numeric equivalents (e.g. "1/2" vs "0.5" when both parse as same float within epsilon).
 */
export function answersMatch(student: string, correct: string): boolean {
  const a = normalizeAnswer(student);
  const b = normalizeAnswer(correct);
  if (!a) return false;
  if (a === b) return true;

  // Also accept if correct lists alternatives separated by "|"
  const alternatives = correct.split("|").map((s) => normalizeAnswer(s));
  if (alternatives.includes(a)) return true;

  const numA = tryParseNumber(a);
  const numB = tryParseNumber(b);
  if (numA !== null && numB !== null) {
    return Math.abs(numA - numB) < 1e-6;
  }

  // Check against numeric alternatives
  for (const alt of alternatives) {
    const numAlt = tryParseNumber(alt);
    if (numA !== null && numAlt !== null && Math.abs(numA - numAlt) < 1e-6) {
      return true;
    }
  }

  return false;
}

function tryParseNumber(s: string): number | null {
  const cleaned = s.replace(/,/g, "").replace(/%$/, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  // simple fraction a/b
  const frac = cleaned.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return Number(frac[1]) / den;
  }
  return null;
}

export function practiceBandFromPercentage(percentage: number): PracticeBand {
  if (percentage >= 85) return "Strong";
  if (percentage >= 73) return "Practice passing";
  return "Below practice threshold";
}
