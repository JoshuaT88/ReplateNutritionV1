import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as profileService from '../services/profile.service.js';
import { firstParam } from '../utils/http.js';
import prisma from '../config/database.js';

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = 'uploads/avatars';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Use cryptographically secure random bytes instead of Math.random()
    const randomPart = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${randomPart}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});


const router = Router();
router.use(authenticate);

// Validated allergen/condition string: printable chars only, max 150 chars
const allergenField = z.string().min(1).max(150).regex(/^[\p{L}\p{N}\s\-.,/()'&]+$/u);
// Dietary/restriction strings can be slightly more permissive
const restrictionField = z.string().min(1).max(150);

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['HUMAN', 'PET']),
  petType: z.string().max(50).optional().nullable(),
  breed: z.string().max(100).optional().nullable(),
  dietType: z.string().max(50).optional().nullable(),
  feedingSchedule: z.object({
    mealsPerDay: z.number().int().min(1).max(10).optional(),
    amountPerFeeding: z.string().max(50).optional(),
    times: z.array(z.string().max(20)).max(10).optional(),
  }).nullable().optional(),
  age: z.number().int().positive().max(150).optional().nullable(),
  weight: z.number().positive().max(2000).optional().nullable(),
  criticalAllergies: z.array(allergenField).max(20).default([]),
  allergies: z.array(allergenField).max(30).default([]),
  intolerances: z.array(allergenField).max(20).default([]),
  dietaryRestrictions: z.array(restrictionField).max(20).default([]),
  specialConditions: z.array(restrictionField).max(15).default([]),
  foodPreferences: z.array(z.string().min(1).max(200)).max(30).default([]),
  foodDislikes: z.array(z.string().min(1).max(200)).max(30).default([]),
  notes: z.string().max(2000).optional().nullable(),
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

router.post('/:id/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profileId = firstParam(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Verify profile belongs to user
    const profile = await prisma.profile.findFirst({
      where: { id: profileId!, userId: req.user!.userId },
    });
    if (!profile) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Remove old avatar file if it exists and is local — with path traversal protection
    if (profile.avatarUrl?.startsWith('/uploads/avatars/')) {
      const uploadsBase = path.resolve('uploads/avatars');
      // Reconstruct path from URL and confirm it stays within the uploads directory
      const filename = path.basename(profile.avatarUrl);
      const oldPath = path.join(uploadsBase, filename);
      // Verify the resolved path is still inside the uploads directory
      if (oldPath.startsWith(uploadsBase + path.sep) || oldPath === uploadsBase) {
        fs.unlink(oldPath, () => {});
      }
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await prisma.profile.update({
      where: { id: profileId! },
      data: { avatarUrl },
    });

    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) { next(err); }
});

export default router;
