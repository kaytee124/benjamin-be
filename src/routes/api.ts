import { Router } from "express";
import { SUBJECTS } from "../lib/constants";
import { getMathQuestions, toPublicQuestion } from "../data/math-questions";
import { listAttempts, persistAttempt } from "../lib/db";
import { answersMatch, practiceBandFromPercentage } from "../lib/scoring";
import {
  createMathSession,
  getSession,
  publicSessionQuestions,
} from "../lib/sessions";
import { normalizeStudentId } from "../lib/studentId";
import type { QuestionReview, SubmitRequest, SubmitResponse } from "../lib/types";

const router = Router();

router.get("/subjects", (_req, res) => {
  res.json({ subjects: SUBJECTS });
});

/** Legacy fixed bank (still available). Prefer POST /sessions for new attempts. */
router.get("/subjects/math/questions", (_req, res) => {
  const questions = getMathQuestions().map(toPublicQuestion);
  res.json({
    subject: SUBJECTS[0],
    questions,
  });
});

router.post("/subjects/math/sessions", async (req, res) => {
  const studentId = normalizeStudentId(req.body?.studentId);
  if (!studentId) {
    res.status(400).json({
      error: "studentId required (practice name or ID).",
    });
    return;
  }

  try {
    const session = await createMathSession(studentId);
    res.status(201).json({
      subject: SUBJECTS[0],
      sessionId: session.sessionId,
      studentId,
      questions: session.questions,
    });
  } catch (err) {
    console.error("Failed to create session", err);
    res.status(500).json({ error: "Failed to create test session." });
  }
});

router.get("/subjects/math/sessions/:id", async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      subject: SUBJECTS[0],
      sessionId: session.id,
      studentId: session.studentId,
      questions: publicSessionQuestions(session.questions),
    });
  } catch (err) {
    console.error("Failed to load session", err);
    res.status(500).json({ error: "Failed to load test session." });
  }
});

/** Past scored attempts for one practice ID (no passcode — student-facing). */
router.get("/subjects/math/attempts", async (req, res) => {
  const studentId = normalizeStudentId(
    typeof req.query.studentId === "string" ? req.query.studentId : undefined
  );
  if (!studentId) {
    res.status(400).json({
      error: "studentId query required (practice name or ID).",
    });
    return;
  }

  try {
    const attempts = await listAttempts(studentId);
    res.json({ studentId, attempts });
  } catch (err) {
    console.error("Failed to list attempts", err);
    res.status(500).json({ error: "Failed to load test history." });
  }
});

router.post("/subjects/math/submit", async (req, res) => {
  const body = req.body as SubmitRequest;

  if (!body?.answers || !Array.isArray(body.answers)) {
    res.status(400).json({ error: "answers array required" });
    return;
  }

  if (!body.sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }

  const studentId = normalizeStudentId(body.studentId);
  if (!studentId) {
    res.status(400).json({ error: "studentId required (practice name or ID)." });
    return;
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found or expired." });
    return;
  }

  if (session.studentId !== studentId) {
    res.status(400).json({
      error: "studentId does not match this session.",
    });
    return;
  }

  const questions = session.questions;
  const answerMap = new Map(
    body.answers.map((a) => [a.questionId, a.studentAnswer ?? ""])
  );

  let correct = 0;
  const review: QuestionReview[] = questions.map((q) => {
    const studentAnswer = answerMap.get(q.id) ?? "";
    const isCorrect = answersMatch(studentAnswer, q.correctAnswer);
    if (isCorrect) correct += 1;

    const displayCorrect = q.correctAnswer.split("|")[0].trim();

    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      studentAnswer: studentAnswer || null,
      correctAnswer: displayCorrect,
      isCorrect,
      explanation: q.explanation,
      topic: q.topic,
      figureSvg: q.figureSvg,
    };
  });

  const total = questions.length;
  const percentage =
    total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
  const practiceBand = practiceBandFromPercentage(percentage);

  const response: SubmitResponse = {
    score: { correct, total, percentage },
    practiceBand,
    review,
  };

  try {
    const attemptId = await persistAttempt({
      studentId,
      startedAt: body.startedAt,
      submittedAt: body.submittedAt,
      correct,
      total,
      percentage,
      practiceBand,
      review,
    });
    if (attemptId) {
      console.log(
        `Persisted attempt ${attemptId} for student ${studentId} session ${body.sessionId}`
      );
    }
  } catch (err) {
    console.error("Failed to persist attempt (score still returned)", err);
  }

  res.json(response);
});

export default router;
