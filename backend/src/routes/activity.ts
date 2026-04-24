import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getActivity } from '../services/activity.service.js';

const router = Router();

const querySchema = z.object({
  profileId: z.string().uuid().optional(),
  entityType: z.string().max(50).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    const logs = await getActivity(req.user!.userId, q);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
