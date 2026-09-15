export type QuestionType = "multiple_choice" | "short_answer";

export interface SubjectMeta {
  id: "math";
  name: string;
  timeLimitMinutes: number;
  questionCount: number;
  noCalculatorCount: number;
}

export interface Question {
  id: string;
  subjectId: "math";
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  topic?: string;
  calculatorAllowed: boolean;
  /** Trusted server-generated SVG markup for diagrams. */
  figureSvg?: string;
}

/** Question payload sent to the client (no answer key). */
export type PublicQuestion = Omit<Question, "correctAnswer" | "explanation">;

export interface StudentAnswer {
  questionId: string;
  studentAnswer: string;
}

export interface SubmitRequest {
  answers: StudentAnswer[];
  startedAt: string;
  submittedAt?: string;
  /** Required for unique per-attempt forms. */
  sessionId?: string;
  /** Practice ID / student slug — scopes attempt history. */
  studentId?: string;
}

export type PracticeBand = "Below practice threshold" | "Practice passing" | "Strong";

export interface QuestionReview {
  questionId: string;
  prompt: string;
  type: QuestionType;
  options?: string[];
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  topic?: string;
  figureSvg?: string;
}

export interface SubmitResponse {
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  practiceBand: PracticeBand;
  review: QuestionReview[];
  /** Persisted attempt id when history write succeeds. */
  attemptId?: string;
}
