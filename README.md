# benjamin-be

Express API for the GED Math practice app: subject metadata, question bank (without answers on GET), and server-side scoring.

## Setup

```bash
npm install
npm run dev
```

Server defaults to [http://localhost:4000](http://localhost:4000).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/subjects` | Subject metadata |
| GET | `/api/subjects/math/questions` | Public questions (no answer key) |
| POST | `/api/subjects/math/submit` | Score answers; return review |

## Env

| Variable | Default | Notes |
|----------|---------|--------|
| `PORT` | `4000` | Listen port |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins |

## Scripts

- `npm run dev` — watch mode with tsx
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
