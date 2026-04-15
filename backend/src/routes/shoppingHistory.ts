import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/errorHandler.js';
import { extractReceiptData } from '../services/ai.service.js';
import { submitPrice } from '../services/pricing.service.js';
import { firstParam } from '../utils/http.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve('uploads/receipts'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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
    const historyId = firstParam(req.params.id);
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: historyId, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    const updated = await prisma.shoppingHistory.update({
      where: { id: historyId },
      data: req.body,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const historyId = firstParam(req.params.id);
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: historyId, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    await prisma.shoppingHistory.delete({ where: { id: historyId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/receipts', upload.array('receipts', 10), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const historyId = firstParam(req.params.id);
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: historyId, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError(400, 'No files received. Please try again.');
    }

    const urls = files.map((f) => `/uploads/receipts/${f.filename}`);

    const updated = await prisma.shoppingHistory.update({
      where: { id: historyId },
      data: { receiptUrls: [...existing.receiptUrls, ...urls] },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// OCR: extract items from a receipt image and optionally submit prices
router.post('/:id/receipts/scan', upload.single('receipt'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const historyId = firstParam(req.params.id);
    const existing = await prisma.shoppingHistory.findFirst({
      where: { id: historyId, userId: req.user!.userId },
    });
    if (!existing) throw new AppError(404, 'Shopping history not found');

    const file = req.file;
    if (!file) throw new AppError(400, 'No receipt image provided');

    // Read the file and convert to base64 for the vision API
    const filePath = path.resolve(file.path);
    const imageBuffer = fs.readFileSync(filePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    const ocrResult = await extractReceiptData(imageBase64, mimeType);

    // Save the receipt URL
    const receiptUrl = `/uploads/receipts/${file.filename}`;
    await prisma.shoppingHistory.update({
      where: { id: historyId },
      data: { receiptUrls: [...existing.receiptUrls, receiptUrl] },
    });

    // Auto-submit extracted prices to crowd-sourced DB
    const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user!.userId } });
    const zipRegion = prefs?.zipCode?.slice(0, 3) || '000';
    const storeName = ocrResult.storeName || existing.storeName;

    let pricesSubmitted = 0;
    for (const item of ocrResult.items) {
      if (item.price > 0 && item.itemName) {
        try {
          const result = await submitPrice(req.user!.userId, {
            itemName: item.itemName,
            storeName,
            zipRegion,
            actualPrice: item.price,
            quantity: item.quantity || 1,
          });
          if (result && !('flaggedOutlier' in result && result.flaggedOutlier)) {
            pricesSubmitted++;
          }
        } catch {
          // Skip items that fail outlier checks
        }
      }
    }

    // Update history with OCR total if we don't already have one
    if (ocrResult.total && !existing.actualCost) {
      await prisma.shoppingHistory.update({
        where: { id: historyId },
        data: { actualCost: ocrResult.total },
      });
    }

    res.json({
      ...ocrResult,
      receiptUrl,
      pricesSubmitted,
    });
  } catch (err) { next(err); }
});

export default router;
