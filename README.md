# benjamin-be

Express API for the GED Math practice app: subject metadata, **unique per-attempt question sessions** (parametric templates, no LLM), server-side scoring, and coach topic analytics.

## Setup

```bash
npm install
cp .env.example .env   # optional for local DB + coach passcode
npm run dev
```

Server defaults to [http://localhost:4000](http://localhost:4000).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (`database` / `coachConfigured` flags) |
| GET | `/api/subjects` | Subject metadata |
| GET | `/api/subjects/math/questions` | Legacy fixed bank (no answer key) |
| POST | `/api/subjects/math/sessions` | Create a fresh 46-question form (5 no-calc + 41 calc) |
| GET | `/api/subjects/math/sessions/:id` | Resume a session (public questions only) |
| POST | `/api/subjects/math/submit` | Score answers for a `sessionId`; persist attempt when DB set |
| GET | `/api/coach/attempts` | Attempt history (coach passcode) |
| GET | `/api/coach/analytics` | Topic stats + flags (coach passcode) |

### Unique forms (no LLM)

Each `POST /sessions` builds questions from parametric templates under `src/data/templates/` (~50 generators). Forms target a **GED-like mix** (~45% quantitative / ~55% algebraic ≈ 21/25 on a 46-item form). Template repeats are allowed with a **dynamic cap** (base 3; up to 5 for weak topics; hard max 6). After **8+** scored attempts, the **4 weakest** flagged/low-accuracy topics get higher weight (and higher per-template caps) so the student sees more practice where they struggle—without drowning the form when many topics are mildly weak. Exact stem fingerprints stay rare via `seen_fingerprints` when Postgres is configured. Sessions live ~8 hours (memory + optional Postgres).

Submit body must include `sessionId`.

## Topic flags (no LLM)

A topic is **flagged** when either:

- at least 3 items attempted on that topic and overall accuracy &lt; 70%, or
- the topic was missed on 2 of the last 3 attempts that included it

## Env

| Variable | Default | Notes |
|----------|---------|--------|
| `PORT` | `4000` | Listen port (Render sets this automatically) |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins |
| `DATABASE_URL` | — | Postgres; history, analytics, and cross-attempt seen tracking |
| `DATABASE_SSL` | on (non-false) | Set `false` for local Postgres without SSL |
| `COACH_PASSCODE` | — | Shared passcode for coach API |

Without `DATABASE_URL`, sessions still work **in memory** on that process; scoring works; history/seen tracking need Postgres.

## Deploy on Render

1. Create a **Postgres** instance → `DATABASE_URL`.
2. Set `COACH_PASSCODE` and `CORS_ORIGIN`.
3. **Build:** `npm install && npm run build` · **Start:** `npm start`

## Scripts

- `npm run dev` — watch mode with tsx
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
