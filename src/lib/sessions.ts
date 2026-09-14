import { randomUUID } from "crypto";
import type { GeneratedQuestion } from "../data/templates/types";
import { buildMathForm } from "../data/templates/buildForm";
import { buildTopicAnalytics } from "./analytics";
import {
  ensureSchema,
  getPool,
  isDbConfigured,
  listAttempts,
  listTopicItems,
} from "./db";
import { toPublicQuestion } from "../data/math-questions";
import type { PublicQuestion, Question } from "./types";

export interface SessionRecord {
  id: string;
  studentId: string;
  createdAt: string;
  expiresAt: string;
  questions: GeneratedQuestion[];
}

const memorySessions = new Map<string, SessionRecord>();
/** Per-student template usage when Postgres is unavailable or as a supplement. */
const memoryTemplateUsage = new Map<string, Map<string, number>>();
const memorySeenFingerprints = new Map<string, Set<string>>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function toStoredQuestion(q: GeneratedQuestion): Question {
  const { templateId: _t, fingerprint: _f, ...rest } = q;
  return rest;
}

export function publicSessionQuestions(
  questions: GeneratedQuestion[]
): PublicQuestion[] {
  return questions.map((q) => toPublicQuestion(toStoredQuestion(q)));
}

export async function ensureSessionSchema(): Promise<void> {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'default',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_items (
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      question_json JSONB NOT NULL,
      correct_answer TEXT NOT NULL,
      topic TEXT,
      template_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      PRIMARY KEY (session_id, position)
    );

    CREATE TABLE IF NOT EXISTS seen_fingerprints (
      student_id TEXT NOT NULL DEFAULT 'default',
      fingerprint TEXT NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (student_id, fingerprint)
    );

    CREATE INDEX IF NOT EXISTS session_items_fingerprint_idx
      ON session_items(fingerprint);
    CREATE INDEX IF NOT EXISTS sessions_student_id_idx
      ON sessions(student_id);
  `);

  // Migrate existing tables created before student_id
  await db.query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_id TEXT;
    UPDATE sessions SET student_id = 'default' WHERE student_id IS NULL;
    ALTER TABLE sessions ALTER COLUMN student_id SET DEFAULT 'default';
    ALTER TABLE sessions ALTER COLUMN student_id SET NOT NULL;
  `);

  // Rebuild seen_fingerprints PK if old single-column PK exists
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'seen_fingerprints'
          AND column_name = 'fingerprint'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'seen_fingerprints'
          AND column_name = 'student_id'
      ) THEN
        ALTER TABLE seen_fingerprints ADD COLUMN student_id TEXT;
        UPDATE seen_fingerprints SET student_id = 'default' WHERE student_id IS NULL;
        ALTER TABLE seen_fingerprints DROP CONSTRAINT IF EXISTS seen_fingerprints_pkey;
        ALTER TABLE seen_fingerprints
          ALTER COLUMN student_id SET DEFAULT 'default',
          ALTER COLUMN student_id SET NOT NULL;
        ALTER TABLE seen_fingerprints
          ADD PRIMARY KEY (student_id, fingerprint);
      END IF;
    END $$;
  `);
}

function memUsage(studentId: string): Map<string, number> {
  let m = memoryTemplateUsage.get(studentId);
  if (!m) {
    m = new Map();
    memoryTemplateUsage.set(studentId, m);
  }
  return m;
}

function memSeen(studentId: string): Set<string> {
  let s = memorySeenFingerprints.get(studentId);
  if (!s) {
    s = new Set();
    memorySeenFingerprints.set(studentId, s);
  }
  return s;
}

export async function getSeenFingerprints(
  studentId: string
): Promise<Set<string>> {
  const seen = new Set(memSeen(studentId));
  const db = getPool();
  if (!db) return seen;
  await ensureSessionSchema();
  const result = await db.query<{ fingerprint: string }>(
    `SELECT fingerprint FROM seen_fingerprints
     WHERE student_id = $1
     ORDER BY last_seen_at DESC
     LIMIT 2000`,
    [studentId]
  );
  for (const row of result.rows) seen.add(row.fingerprint);
  return seen;
}

/** How often each template has appeared for this student (for rotation). */
export async function getTemplateUsageCounts(
  studentId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>(memUsage(studentId));
  const db = getPool();
  if (!db) return map;
  await ensureSessionSchema();
  const result = await db.query<{ template_id: string; n: string }>(
    `SELECT si.template_id, COUNT(*)::text AS n
     FROM session_items si
     JOIN sessions s ON s.id = si.session_id
     WHERE s.student_id = $1
     GROUP BY si.template_id`,
    [studentId]
  );
  for (const row of result.rows) {
    const fromDb = Number(row.n) || 0;
    map.set(row.template_id, Math.max(map.get(row.template_id) ?? 0, fromDb));
  }
  return map;
}

function recordTemplateUsage(
  studentId: string,
  questions: GeneratedQuestion[]
): void {
  const usage = memUsage(studentId);
  const seen = memSeen(studentId);
  for (const q of questions) {
    usage.set(q.templateId, (usage.get(q.templateId) ?? 0) + 1);
    seen.add(q.fingerprint);
  }
}

export async function createMathSession(studentId: string): Promise<{
  sessionId: string;
  questions: PublicQuestion[];
}> {
  const [seen, templateUsage, attempts, topicRows] = await Promise.all([
    getSeenFingerprints(studentId),
    getTemplateUsageCounts(studentId),
    listAttempts(studentId),
    listTopicItems(studentId),
  ]);

  const topicAnalytics = buildTopicAnalytics(topicRows);
  const topicWeaknesses = topicAnalytics.map((t) => ({
    topic: t.topic,
    accuracy: t.accuracy,
    flagged: t.flagged,
  }));

  const { questions } = buildMathForm({
    seenFingerprints: seen,
    templateUsage,
    attemptCount: attempts.length,
    topicWeaknesses,
  });
  recordTemplateUsage(studentId, questions);
  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

  const record: SessionRecord = {
    id,
    studentId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    questions,
  };

  memorySessions.set(id, record);

  const db = getPool();
  // Sim / bulk scripts can skip session DB writes; attempts still persist for coach.
  if (db && process.env.SKIP_SESSION_PERSIST !== "1") {
    await ensureSessionSchema();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO sessions (id, student_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [id, studentId, createdAt, expiresAt]
      );

      // Batch session_items (one round-trip)
      const positions: number[] = [];
      const jsons: string[] = [];
      const answers: string[] = [];
      const topics: (string | null)[] = [];
      const templateIds: string[] = [];
      const fingerprints: string[] = [];
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        positions.push(i);
        jsons.push(JSON.stringify(toStoredQuestion(q)));
        answers.push(q.correctAnswer);
        topics.push(q.topic ?? null);
        templateIds.push(q.templateId);
        fingerprints.push(q.fingerprint);
      }
      await client.query(
        `INSERT INTO session_items
          (session_id, position, question_json, correct_answer, topic, template_id, fingerprint)
         SELECT $1, u.position, u.question_json::jsonb, u.correct_answer, u.topic, u.template_id, u.fingerprint
         FROM UNNEST(
           $2::int[],
           $3::text[],
           $4::text[],
           $5::text[],
           $6::text[],
           $7::text[]
         ) AS u(position, question_json, correct_answer, topic, template_id, fingerprint)`,
        [id, positions, jsons, answers, topics, templateIds, fingerprints]
      );

      await client.query(
        `INSERT INTO seen_fingerprints (student_id, fingerprint, last_seen_at)
         SELECT $1, f, NOW()
         FROM UNNEST($2::text[]) AS f
         ON CONFLICT (student_id, fingerprint)
         DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
        [studentId, fingerprints]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to persist session to DB; using memory only", err);
    } finally {
      client.release();
    }
  }

  return {
    sessionId: id,
    questions: publicSessionQuestions(questions),
  };
}

export async function getSession(
  sessionId: string
): Promise<SessionRecord | null> {
  const mem = memorySessions.get(sessionId);
  if (mem) {
    if (new Date(mem.expiresAt).getTime() < Date.now()) {
      memorySessions.delete(sessionId);
    } else {
      return mem;
    }
  }

  const db = getPool();
  if (!db) return null;
  await ensureSessionSchema();

  const session = await db.query<{
    id: string;
    student_id: string;
    created_at: Date;
    expires_at: Date;
  }>(
    `SELECT id, student_id, created_at, expires_at FROM sessions WHERE id = $1`,
    [sessionId]
  );
  if (session.rowCount === 0) return null;
  const row = session.rows[0];
  if (row.expires_at.getTime() < Date.now()) return null;

  const items = await db.query<{
    position: number;
    question_json: Question;
    correct_answer: string;
    topic: string | null;
    template_id: string;
    fingerprint: string;
  }>(
    `SELECT position, question_json, correct_answer, topic, template_id, fingerprint
     FROM session_items WHERE session_id = $1 ORDER BY position ASC`,
    [sessionId]
  );

  const questions: GeneratedQuestion[] = items.rows.map((item) => {
    const q =
      typeof item.question_json === "string"
        ? (JSON.parse(item.question_json) as Question)
        : item.question_json;
    return {
      ...q,
      correctAnswer: item.correct_answer,
      topic: item.topic ?? q.topic,
      templateId: item.template_id,
      fingerprint: item.fingerprint,
    };
  });

  const record: SessionRecord = {
    id: row.id,
    studentId: row.student_id ?? "default",
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    questions,
  };
  memorySessions.set(sessionId, record);
  return record;
}

export function isDbConfiguredForSessions(): boolean {
  return isDbConfigured();
}

/** Clear per-student session memory (tests only). */
export function clearMemorySessions(): void {
  memorySessions.clear();
  memoryTemplateUsage.clear();
  memorySeenFingerprints.clear();
}
