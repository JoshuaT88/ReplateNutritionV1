import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as recService from '../services/recommendation.service.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.query;
    const recs = await recService.getRecommendations(req.user!.userId, profileId as string);
    res.json(recs);
  } catch (err) { next(err); }
});

router.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profileIds, categories } = req.body;
    const recs = await recService.generateRecommendations(req.user!.userId, profileIds, categories);
    res.status(201).json(recs);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rec = await recService.updateRecommendation(req.user!.userId, req.params.id, req.body);
    res.json(rec);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await recService.deleteRecommendation(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
