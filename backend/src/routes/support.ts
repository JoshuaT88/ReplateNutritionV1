/**
 * Support Routes
 * POST /api/support/report  — user-submitted issue report (auth required)
 * POST /api/support/feedback — ideas / feature suggestions (auth required)
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { reportUserIssue } from '../services/monitoring.service.js';
import prisma from '../config/database.js';

const router = Router();
router.use(authenticate);

const reportSchema = z.object({
  description: z.string().min(5).max(2000),
  route: z.string().max(200).optional(),
  workflow: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const feedbackSchema = z.object({
  type: z.enum(['feature', 'improvement', 'general']),
  subject: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
});

// POST /api/support/report — issue during a workflow
router.post('/report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = reportSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    await reportUserIssue({
      userId,
      userEmail: user?.email,
      userName: user?.fullName,
      description: data.description,
      route: data.route,
      workflow: data.workflow || 'issue-report',
      metadata: data.metadata,
    });

    res.json({ success: true, message: 'Report received — we\'ll look into it.' });
  } catch (err) { next(err); }
});

// POST /api/support/feedback — ideas and recommendations
router.post('/feedback', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = feedbackSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    await reportUserIssue({
      userId,
      userEmail: user?.email,
      userName: user?.fullName,
      description: `[${data.type.toUpperCase()}] ${data.subject}\n\n${data.description}`,
      workflow: `feedback-${data.type}`,
      metadata: { type: data.type, subject: data.subject },
    });

    res.json({ success: true, message: 'Thanks for your feedback!' });
  } catch (err) { next(err); }
});

export default router;
