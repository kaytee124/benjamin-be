import { randomUUID } from "crypto";
import { Pool } from "pg";
import type { PracticeBand, QuestionReview } from "./types";

let pool: Pool | null = null;
let migratePromise: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): Pool | null {
  if (!isDbConfigured()) return null;
  if (!pool) {
    // Aiven/cloud often need TLS without full CA verification in Node.
    // Prefer Pool.ssl over URL sslmode=require (which maps to verify-full in pg).
    const rawUrl = process.env.DATABASE_URL!.trim();
    let connectionString = rawUrl;
    try {
      const u = new URL(rawUrl);
      u.searchParams.delete("sslmode");
      u.searchParams.delete("uselibpqcompat");
      connectionString = u.toString();
    } catch {
      // keep raw
    }
    const useSsl = process.env.DATABASE_SSL !== "false";
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export interface AttemptSummary {
  id: string;
  studentId: string;
  startedAt: string | null;
  submittedAt: string;
  correct: number;
  total: number;
  percentage: number;
  practiceBand: string;
}

export interface TopicItemRow {
  attempt_id: string;
  submitted_at: Date;
  question_id: string;
  topic: string;
  is_correct: boolean;
}

export interface PersistAttemptInput {
  studentId: string;
  startedAt?: string;
  submittedAt?: string;
  correct: number;
  total: number;
  percentage: number;
  practiceBand: PracticeBand;
  review: QuestionReview[];
}

/** In-memory history so local/dev and tests work without Postgres. */
interface MemoryBundle {
  attempts: AttemptSummary[];
  items: TopicItemRow[];
}

const memoryByStudent = new Map<string, MemoryBundle>();

function memBundle(studentId: string): MemoryBundle {
  let b = memoryByStudent.get(studentId);
  if (!b) {
    b = { attempts: [], items: [] };
    memoryByStudent.set(studentId, b);
  }
  return b;
}

function recordMemoryAttempt(
  studentId: string,
  attemptId: string,
  input: PersistAttemptInput
): void {
  const bundle = memBundle(studentId);
  const submittedAt = input.submittedAt
    ? new Date(input.submittedAt).toISOString()
    : new Date().toISOString();
  bundle.attempts.unshift({
    id: attemptId,
    studentId,
    startedAt: input.startedAt ?? null,
    submittedAt,
    correct: input.correct,
    total: input.total,
    percentage: input.percentage,
    practiceBand: input.practiceBand,
  });
  for (const item of input.review) {
    if (!item.topic) continue;
    bundle.items.unshift({
      attempt_id: attemptId,
      submitted_at: new Date(submittedAt),
      question_id: item.questionId,
      topic: item.topic,
      is_correct: item.isCorrect,
    });
  }
}

function memoryAttempts(studentId?: string): AttemptSummary[] {
  if (studentId) {
    return [...(memoryByStudent.get(studentId)?.attempts ?? [])];
  }
  return [...memoryByStudent.values()].flatMap((b) => b.attempts);
}

function memoryTopicItems(studentId?: string): TopicItemRow[] {
  if (studentId) {
    return [...(memoryByStudent.get(studentId)?.items ?? [])];
  }
  return [...memoryByStudent.values()].flatMap((b) => b.items);
}

/** Clear in-memory attempt history (tests only). */
export function clearMemoryAttempts(): void {
  memoryByStudent.clear();
}

export async function ensureSchema(): Promise<void> {
  const db = getPool();
  if (!db) return;

  if (!migratePromise) {
    migratePromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS attempts (
          id UUID PRIMARY KEY,
          student_id TEXT NOT NULL DEFAULT 'default',
          started_at TIMESTAMPTZ,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          correct INTEGER NOT NULL,
          total INTEGER NOT NULL,
          percentage DOUBLE PRECISION NOT NULL,
          practice_band TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attempt_items (
          id SERIAL PRIMARY KEY,
          attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL,
          topic TEXT,
          is_correct BOOLEAN NOT NULL,
          student_answer TEXT
        );

        CREATE INDEX IF NOT EXISTS attempt_items_attempt_id_idx
          ON attempt_items(attempt_id);
        CREATE INDEX IF NOT EXISTS attempt_items_topic_idx
          ON attempt_items(topic);
        CREATE INDEX IF NOT EXISTS attempts_submitted_at_idx
          ON attempts(submitted_at DESC);
        CREATE INDEX IF NOT EXISTS attempts_student_id_idx
          ON attempts(student_id);
      `);

      await db.query(`
        ALTER TABLE attempts
          ADD COLUMN IF NOT EXISTS student_id TEXT;
        UPDATE attempts SET student_id = 'default' WHERE student_id IS NULL;
        ALTER TABLE attempts
          ALTER COLUMN student_id SET DEFAULT 'default';
        ALTER TABLE attempts
          ALTER COLUMN student_id SET NOT NULL;
      `);

      console.log("Database schema ready");
    })().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }

  await migratePromise;
}

export async function persistAttempt(
  input: PersistAttemptInput
): Promise<string | null> {
  const id = randomUUID();
  recordMemoryAttempt(input.studentId, id, input);

  const db = getPool();
  if (!db) return id;

  await ensureSchema();

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO attempts
        (id, student_id, started_at, submitted_at, correct, total, percentage, practice_band)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.studentId,
        input.startedAt ? new Date(input.startedAt) : null,
        input.submittedAt ? new Date(input.submittedAt) : new Date(),
        input.correct,
        input.total,
        input.percentage,
        input.practiceBand,
      ]
    );

    if (input.review.length > 0) {
      const qids = input.review.map((r) => r.questionId);
      const topics = input.review.map((r) => r.topic ?? null);
      const corrects = input.review.map((r) => r.isCorrect);
      const answers = input.review.map((r) => r.studentAnswer);
      await client.query(
        `INSERT INTO attempt_items
          (attempt_id, question_id, topic, is_correct, student_answer)
         SELECT $1, u.question_id, u.topic, u.is_correct, u.student_answer
         FROM UNNEST(
           $2::text[],
           $3::text[],
           $4::boolean[],
           $5::text[]
         ) AS u(question_id, topic, is_correct, student_answer)`,
        [id, qids, topics, corrects, answers]
      );
    }

    await client.query("COMMIT");
    return id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listAttempts(
  studentId?: string
): Promise<AttemptSummary[]> {
  const fromMem = memoryAttempts(studentId);
  const db = getPool();
  if (!db) return fromMem;
  await ensureSchema();

  const result = studentId
    ? await db.query<{
        id: string;
        student_id: string;
        started_at: Date | null;
        submitted_at: Date;
        correct: number;
        total: number;
        percentage: number;
        practice_band: string;
      }>(
        `SELECT id, student_id, started_at, submitted_at, correct, total, percentage, practice_band
         FROM attempts
         WHERE student_id = $1
         ORDER BY submitted_at DESC`,
        [studentId]
      )
    : await db.query<{
        id: string;
        student_id: string;
        started_at: Date | null;
        submitted_at: Date;
        correct: number;
        total: number;
        percentage: number;
        practice_band: string;
      }>(
        `SELECT id, student_id, started_at, submitted_at, correct, total, percentage, practice_band
         FROM attempts
         ORDER BY submitted_at DESC`
      );

  const fromDb = result.rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    submittedAt: row.submitted_at.toISOString(),
    correct: row.correct,
    total: row.total,
    percentage: row.percentage,
    practiceBand: row.practice_band,
  }));

  const seen = new Set(fromDb.map((a) => a.id));
  const merged = [
    ...fromDb,
    ...fromMem.filter((a) => !seen.has(a.id)),
  ].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  return merged;
}

export async function listTopicItems(
  studentId?: string
): Promise<TopicItemRow[]> {
  const fromMem = memoryTopicItems(studentId);
  const db = getPool();
  if (!db) return fromMem;
  await ensureSchema();

  const result = studentId
    ? await db.query<TopicItemRow>(
        `SELECT i.attempt_id, a.submitted_at, i.question_id, i.topic, i.is_correct
         FROM attempt_items i
         JOIN attempts a ON a.id = i.attempt_id
         WHERE a.student_id = $1
           AND i.topic IS NOT NULL AND i.topic <> ''
         ORDER BY a.submitted_at DESC`,
        [studentId]
      )
    : await db.query<TopicItemRow>(
        `SELECT i.attempt_id, a.submitted_at, i.question_id, i.topic, i.is_correct
         FROM attempt_items i
         JOIN attempts a ON a.id = i.attempt_id
         WHERE i.topic IS NOT NULL AND i.topic <> ''
         ORDER BY a.submitted_at DESC`
      );

  const seen = new Set(
    result.rows.map((r) => `${r.attempt_id}:${r.question_id}`)
  );
  const merged = [
    ...result.rows,
    ...fromMem.filter(
      (r) => !seen.has(`${r.attempt_id}:${r.question_id}`)
    ),
  ].sort(
    (a, b) => b.submitted_at.getTime() - a.submitted_at.getTime()
  );
  return merged;
}

export async function listStudentIds(): Promise<string[]> {
  const fromMem = [...memoryByStudent.keys()];
  const db = getPool();
  if (!db) return [...new Set(fromMem)].sort();
  await ensureSchema();
  const result = await db.query<{ student_id: string }>(
    `SELECT DISTINCT student_id FROM attempts ORDER BY student_id ASC`
  );
  return [...new Set([...fromMem, ...result.rows.map((r) => r.student_id)])].sort();
}
