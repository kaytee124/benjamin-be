import { Router } from "express";
import { SUBJECTS } from "../lib/constants";
import { getMathQuestions, toPublicQuestion } from "../data/math-questions";
import { answersMatch, practiceBandFromPercentage } from "../lib/scoring";
import type { QuestionReview, SubmitRequest, SubmitResponse } from "../lib/types";

const router = Router();

router.get("/subjects", (_req, res) => {
  res.json({ subjects: SUBJECTS });
});

router.get("/subjects/math/questions", (_req, res) => {
  const questions = getMathQuestions().map(toPublicQuestion);
  res.json({
    subject: SUBJECTS[0],
    questions,
  });
});

router.post("/subjects/math/submit", (req, res) => {
  const body = req.body as SubmitRequest;

  if (!body?.answers || !Array.isArray(body.answers)) {
    res.status(400).json({ error: "answers array required" });
    return;
  }

  const questions = getMathQuestions();
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
    };
  });

  const total = questions.length;
  const percentage =
    total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;

  const response: SubmitResponse = {
    score: { correct, total, percentage },
    practiceBand: practiceBandFromPercentage(percentage),
    review,
  };

  res.json(response);
});

export default router;
