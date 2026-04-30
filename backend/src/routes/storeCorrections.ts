import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const router = Router();

// ── validation ────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  storeName: z.string().min(1).max(200),
  currentAddress: z.string().min(1).max(500),
  correction: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
});

// ── POST /api/store-corrections  (T64) ───────────────────────────────────────
// Authenticated user submits a correction — saved to DB + dev notified by email

router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'Invalid request body');

    const { storeName, currentAddress, correction, notes } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, fullName: true },
    });
    if (!user) throw new AppError(404, 'User not found');

    const record = await prisma.storeCorrection.create({
      data: {
        userId: req.user!.userId,
        storeName,
        currentAddress,
        correction,
        notes: notes ?? null,
      },
    });

    // Notify dev / admin
    if (resend && env.DEV_EMAIL) {
      const approveCurl = `curl -X POST ${env.FRONTEND_URL || 'http://localhost:3001'}/api/store-corrections/admin/approve/${record.id} -H "Authorization: Bearer ${env.ADMIN_SECRET}"`;
      await resend.emails.send({
        from: env.FROM_EMAIL,
        to: env.DEV_EMAIL,
        subject: `[Replate] Store address correction submitted — ${storeName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
            <h2 style="color:#111">Store Address Correction</h2>
            <p><strong>Submitted by:</strong> ${user.fullName} (${user.email})</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr>
                <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;width:140px">Store</td>
                <td style="padding:8px;border:1px solid #e5e7eb">${storeName}</td>
              </tr>
              <tr style="background:#fef2f2">
                <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Current address</td>
                <td style="padding:8px;border:1px solid #e5e7eb">${currentAddress}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Corrected address</td>
                <td style="padding:8px;border:1px solid #e5e7eb">${correction}</td>
              </tr>
              ${notes ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Notes</td><td style="padding:8px;border:1px solid #e5e7eb">${notes}</td></tr>` : ''}
            </table>
            <p style="font-size:13px;color:#6b7280">To approve and write to store_overrides, run:</p>
            <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto">${approveCurl}</pre>
            <p style="font-size:12px;color:#9ca3af">Record ID: ${record.id}</p>
          </div>`,
      });
    }

    res.status(201).json({ ok: true, id: record.id });
  } catch (err) { next(err); }
});

// ── POST /api/store-corrections/admin/approve/:id  (T65) ─────────────────────
// Admin approves correction → upserts StoreOverride + marks record approved

router.post('/admin/approve/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) throw new AppError(401, 'Unauthorized');

    const correction = await prisma.storeCorrection.findUnique({
      where: { id: String(req.params.id) },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (!correction) throw new AppError(404, 'Correction not found');
    if (correction.status !== 'pending') throw new AppError(409, 'Correction already processed');

    // Upsert the override
    await prisma.storeOverride.upsert({
      where: { storeName: correction.storeName },
      create: {
        storeName: correction.storeName,
        address: correction.correction,
        correctedBy: correction.userId,
      },
      update: {
        address: correction.correction,
        correctedBy: correction.userId,
        approvedAt: new Date(),
      },
    });

    // Mark correction approved
    await prisma.storeCorrection.update({
      where: { id: correction.id },
      data: { status: 'approved' },
    });

    // Notify user
    if (resend && correction.user.email) {
      await resend.emails.send({
        from: env.FROM_EMAIL,
        to: correction.user.email,
        subject: 'Your store address correction was approved — Replate',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
            <h2 style="color:#111">Address Correction Approved</h2>
            <p>Hi ${correction.user.fullName},</p>
            <p>Your correction for <strong>${correction.storeName}</strong> has been reviewed and approved.</p>
            <p>The address has been updated to:<br><strong>${correction.correction}</strong></p>
            <p style="color:#6b7280;font-size:13px">Thank you for helping improve Replate for everyone!</p>
          </div>`,
      });
    }

    res.json({ ok: true, storeName: correction.storeName, address: correction.correction });
  } catch (err) { next(err); }
});

export default router;
