import { Router } from "express";
import { buildTopicAnalytics } from "../lib/analytics";
import { requireCoachPasscode } from "../lib/coachAuth";
import {
  listAttempts,
  listStudentIds,
  listTopicItems,
} from "../lib/db";
import { normalizeStudentId } from "../lib/studentId";

const router = Router();

router.use(requireCoachPasscode);

router.get("/students", async (_req, res) => {
  try {
    const students = await listStudentIds();
    res.json({ students });
  } catch (err) {
    console.error("Failed to list students", err);
    res.status(500).json({ error: "Failed to load students." });
  }
});

router.get("/attempts", async (req, res) => {
  try {
    const raw = typeof req.query.studentId === "string" ? req.query.studentId : "";
    const studentId = raw === "" || raw === "all" ? undefined : normalizeStudentId(raw);
    if (raw && raw !== "all" && !studentId) {
      res.status(400).json({ error: "Invalid studentId." });
      return;
    }
    const attempts = await listAttempts(studentId);
    res.json({ attempts, studentId: studentId ?? null });
  } catch (err) {
    console.error("Failed to list attempts", err);
    res.status(500).json({ error: "Failed to load attempts." });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const raw = typeof req.query.studentId === "string" ? req.query.studentId : "";
    const studentId = raw === "" || raw === "all" ? undefined : normalizeStudentId(raw);
    if (raw && raw !== "all" && !studentId) {
      res.status(400).json({ error: "Invalid studentId." });
      return;
    }

    const [attempts, topicRows, students] = await Promise.all([
      listAttempts(studentId),
      listTopicItems(studentId),
      listStudentIds(),
    ]);
    const topics = buildTopicAnalytics(topicRows);
    res.json({
      studentId: studentId ?? null,
      students,
      attemptCount: attempts.length,
      attempts,
      topics,
      flaggedTopics: topics.filter((t) => t.flagged),
    });
  } catch (err) {
    console.error("Failed to build analytics", err);
    res.status(500).json({ error: "Failed to load analytics." });
  }
});

export default router;
