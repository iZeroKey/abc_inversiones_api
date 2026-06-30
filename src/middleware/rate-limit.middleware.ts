import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.util.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;

const buckets = new Map<string, RateLimitEntry>();
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const getClientKey = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];

  const path = req.originalUrl?.split("?")[0] ?? req.path;
  return `${req.method}:${path}:${forwardedIp?.trim() || req.ip || req.socket.remoteAddress || "unknown"}`;
};

const cleanupExpiredBuckets = (): void => {
  const now = Date.now();
  if (buckets.size < MAX_BUCKETS * 0.9) {
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
    return;
  }

  const sorted = [...buckets.entries()].sort(
    ([_a, entryA], [_b, entryB]) => entryA.resetAt - entryB.resetAt,
  );

  const toEvict = sorted.slice(0, Math.max(sorted.length - MAX_BUCKETS, 0));
  for (const [key] of toEvict) {
    buckets.delete(key);
  }

  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const startCleanupTimer = (): void => {
  if (cleanupTimer || isTest) return;
  cleanupTimer = setInterval(cleanupExpiredBuckets, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
};

export const rateLimit = (options: RateLimitOptions) => {
  startCleanupTimer();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isTest) {
      next();
      return;
    }

    const now = Date.now();
    const key = getClientKey(req);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    current.count += 1;
    buckets.set(key, current);

    const retryAfterSeconds = Math.max(
      Math.ceil((current.resetAt - now) / 1000),
      1,
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(options.max - current.count, 0)),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(current.resetAt / 1000)),
    );

    if (current.count > options.max) {
      sendError(res, 429, options.message);
      return;
    }

    next();
  };
};

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Demasiados intentos. Inténtalo nuevamente en unos minutos.",
});

export const publicRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message:
    "Demasiadas solicitudes desde este origen. Inténtalo nuevamente en unos minutos.",
});

export const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message:
    "Demasiadas cargas de archivos. Inténtalo nuevamente en unos minutos.",
});
