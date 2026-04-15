import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as profileService from '../services/profile.service.js';
import { firstParam } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['HUMAN', 'PET']),
  petType: z.string().optional().nullable(),
  age: z.number().int().positive().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  allergies: z.array(z.string()).default([]),
  intolerances: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).default([]),
  specialConditions: z.array(z.string()).default([]),
  foodPreferences: z.array(z.string()).default([]),
  foodDislikes: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profiles = await profileService.getProfiles(req.user!.userId);
    res.json(profiles);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await profileService.createProfile(req.user!.userId, data);
    res.status(201).json(profile);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profileId = firstParam(req.params.id);
    const profile = await profileService.getProfile(req.user!.userId, profileId!);
    res.json(profile);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.partial().parse(req.body);
    const profileId = firstParam(req.params.id);
    const profile = await profileService.updateProfile(req.user!.userId, profileId!, data);
    res.json(profile);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profileId = firstParam(req.params.id);
    await profileService.deleteProfile(req.user!.userId, profileId!);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
