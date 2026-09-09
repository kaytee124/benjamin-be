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
| `PORT` | `4000` | Listen port (Render sets this automatically) |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins (set to your Vercel URL in production) |

## Deploy on Render

This repo includes [`render.yaml`](render.yaml). If you configure the service manually in the Render dashboard:

| Setting | Value |
|---------|--------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Env `CORS_ORIGIN`** | Your Vercel app URL, e.g. `https://benjamin-fe.vercel.app` (no trailing slash) |
| **Env `NODE_VERSION`** | `20` (recommended) |

`npm run build` must run before start so `dist/index.js` exists. Starting with only `yarn start` / `npm start` and no build step fails with `Cannot find module .../dist/index.js`.

## Scripts

- `npm run dev` — watch mode with tsx
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
