import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(maxRequests: number = 100, windowMs: number = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return;
    }

    record.count++;
    next();
  };
}

/**
 * Stricter rate limiter for sensitive auth endpoints.
 * Keyed by IP + optional email/token to prevent targeted brute-force.
 */
const authCounts = new Map<string, { count: number; resetAt: number }>();

export function authRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Key on IP + email (or token body field) to prevent per-email brute-force
    const ip = req.ip || 'unknown';
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const key = `${ip}:${email}`;
    const now = Date.now();
    const record = authCounts.get(key);

    if (!record || now > record.resetAt) {
      authCounts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res
        .status(429)
        .json({ error: 'Too many attempts. Please wait before trying again.' });
      return;
    }

    record.count++;
    next();
  };
}
