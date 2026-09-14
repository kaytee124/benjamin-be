import "dotenv/config";
import cors from "cors";
import express from "express";
import { ensureSchema, isDbConfigured } from "./lib/db";
import { ensureSessionSchema } from "./lib/sessions";
import apiRouter from "./routes/api";
import coachRouter from "./routes/coach";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "http://localhost:3000,http://localhost:3001";

const allowedOrigins = new Set(
  CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser / same-origin tools may omit Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    database: isDbConfigured(),
    coachConfigured: Boolean(process.env.COACH_PASSCODE?.trim()),
  });
});

app.use("/api", apiRouter);
app.use("/api/coach", coachRouter);

async function start() {
  if (isDbConfigured()) {
    try {
      await ensureSchema();
      await ensureSessionSchema();
    } catch (err) {
      console.error("Schema migration failed on boot (will retry on write)", err);
    }
  } else {
    console.warn(
      "DATABASE_URL not set — scoring + in-memory sessions work; history/analytics/seen tracking need Postgres."
    );
  }

  app.listen(PORT, () => {
    console.log(`benjamin-be listening on http://localhost:${PORT}`);
  });
}

void start();
