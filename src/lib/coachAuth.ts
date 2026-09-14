import type { Request, Response, NextFunction } from "express";

export function requireCoachPasscode(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expected = process.env.COACH_PASSCODE?.trim();
  if (!expected) {
    res.status(503).json({
      error: "Coach access is not configured (COACH_PASSCODE missing).",
    });
    return;
  }

  const provided =
    (req.header("x-coach-passcode") ?? "").trim() ||
    (typeof req.query.passcode === "string" ? req.query.passcode.trim() : "");

  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Invalid coach passcode." });
    return;
  }

  next();
}
