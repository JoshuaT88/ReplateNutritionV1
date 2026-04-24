import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// 5 attempts per 15 minutes per IP+email for login
const loginLimiter = authRateLimiter(5, 15 * 60_000);
// 3 registrations per hour per IP
const registerLimiter = authRateLimiter(3, 60 * 60_000);
// 3 forgot-password requests per hour per IP+email
const forgotLimiter = authRateLimiter(3, 60 * 60_000);
// 5 reset attempts per 15 minutes per IP
const resetLimiter = authRateLimiter(5, 15 * 60_000);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data.email, data.password, data.fullName);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }
    const tokens = await authService.refreshTokens(refreshToken);
    res.json(tokens);
  } catch (err) { next(err); }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) { next(err); }
});

router.post('/reset-password', resetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    res.json({ message: 'Password has been reset.' });
  } catch (err) { next(err); }
});

export default router;
