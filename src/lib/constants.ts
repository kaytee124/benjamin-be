import type { SubjectMeta } from "./types";

export const MATH_SUBJECT: SubjectMeta = {
  id: "math",
  name: "Mathematical Reasoning",
  timeLimitMinutes: 115,
  questionCount: 46,
  noCalculatorCount: 5,
};

export const SUBJECTS: SubjectMeta[] = [MATH_SUBJECT];
