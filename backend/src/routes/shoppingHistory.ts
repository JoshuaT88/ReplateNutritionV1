import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import multer from 'multer';
import path from 'path';
import { AppError } from '../middleware/errorHandler.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/receipts',
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.shoppingHistory.findMany({
      where: { userId: req.user!.userId },
      orderBy: { shoppingDate: 'desc' },
    });
    res.json(history);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.shoppingHistory.create({
      data: { ...req.body, userId: req.user!.userId, shoppingDate: new Date(req.body.shoppingDate) },
    });
    res.status(201).json(history);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    const updated = await prisma.shoppingHistory.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    await prisma.shoppingHistory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/receipts', upload.array('receipts', 10), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    const files = req.files as Express.Multer.File[];
    const urls = files.map((f) => `/uploads/receipts/${f.filename}`);

    const updated = await prisma.shoppingHistory.update({
      where: { id: req.params.id },
      data: { receiptUrls: [...existing.receiptUrls, ...urls] },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
