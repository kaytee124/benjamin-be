import cors from "cors";
import express from "express";
import apiRouter from "./routes/api";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`benjamin-be listening on http://localhost:${PORT}`);
});
