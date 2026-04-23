import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { reportError, logWarn, type ErrorContext } from '../services/monitoring.service.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const status = err.statusCode;
    // Log 4xx as warnings (user errors), 5xx as errors
    if (status >= 500) {
      const ctx: ErrorContext = { route: `${req.method} ${req.path}`, userId: (req as any).user?.userId };
      reportError(err, ctx).catch(() => {});
    } else if (status >= 400) {
      logWarn(`AppError ${status}: ${err.message}`, { route: `${req.method} ${req.path}` }).catch(() => {});
    }
    res.status(status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Unexpected 500 — report to dev
  const context: ErrorContext = {
    route: `${req.method} ${req.path}`,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
  };

  if (req.body && typeof req.body === 'object') {
    const safe = { ...req.body };
    delete safe.password;
    delete safe.passwordHash;
    delete safe.refreshToken;
    context.body = JSON.stringify(safe).slice(0, 200);
  }

  reportError(err, context).catch(() => {});

  res.status(500).json({
    error: 'Something went wrong. Please try again.',
  });
}
