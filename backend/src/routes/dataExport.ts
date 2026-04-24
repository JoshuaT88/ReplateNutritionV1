import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { getRedis } from '../utils/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { Resend } from 'resend';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { z } from 'zod';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function exportCodeKey(userId: string) { return `data_export_code:${userId}`; }
function exportReasonKey(userId: string) { return `data_export_reason:${userId}`; }

async function sendCodeEmail(to: string, code: string) {
  if (!resend) return;
  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject: 'Your Replate Data Export Verification Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#111">Data Export Request</h2>
        <p style="color:#444">Use this code to confirm your data export request. It expires in 5 minutes.</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;
             padding:20px;background:#f4f4f4;border-radius:8px;margin:24px 0;color:#111">${code}</div>
        <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
}

async function sendAdminRequestEmail(userId: string, userEmail: string, reason: string) {
  if (!resend || !env.DEV_EMAIL) return;
  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: env.DEV_EMAIL,
    subject: `[Replate] Data Export Request — ${userEmail}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#111">Data Export Request Received</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#555;font-weight:600">User ID</td><td style="color:#111">${userId}</td></tr>
          <tr><td style="padding:6px 0;color:#555;font-weight:600">Email</td><td style="color:#111">${userEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#555;font-weight:600">Reason</td><td style="color:#111">${reason}</td></tr>
          <tr><td style="padding:6px 0;color:#555;font-weight:600">Requested</td><td style="color:#111">${new Date().toISOString()}</td></tr>
        </table>
        <p style="margin-top:20px">To approve this request and trigger export generation, call:</p>
        <pre style="background:#f4f4f4;padding:12px;border-radius:6px;font-size:12px">
POST /api/admin/data-export/approve
Authorization: Bearer ${env.ADMIN_SECRET}
{ "userId": "${userId}" }
        </pre>
      </div>`,
  });
}

async function sendExportReadyEmail(to: string, downloadUrl: string, expiresAt: Date) {
  if (!resend) return;
  const fullUrl = `${env.FRONTEND_URL}${downloadUrl}`;
  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject: 'Your Replate Data Export is Ready',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#111">Your Data Export is Ready</h2>
        <p style="color:#444">Your Replate data export has been generated. You can download it using the link below.</p>
        <p style="color:#888">This link expires on <strong style="color:#111">${expiresAt.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</strong>.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${fullUrl}" style="background:#4f46e5;color:white;padding:12px 28px;border-radius:8px;
             text-decoration:none;font-weight:600;display:inline-block">Download My Data</a>
        </div>
        <p style="color:#888;font-size:12px">You can also find this link in Settings → Security → Download your data.</p>
      </div>`,
  });
}

// ── PDF builder ────────────────────────────────────────────────────────────

async function buildExportPdf(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, createdAt: true,
      preferences: {
        select: { budget: true, zipCode: true, householdType: true, shoppingFrequency: true, organizerRole: true },
      },
      profiles: {
        select: {
          id: true, name: true, type: true, petType: true,
          allergies: true, intolerances: true, dietaryRestrictions: true,
          criticalAllergies: true, specialConditions: true, notes: true, createdAt: true,
        },
      },
      mealPlans: {
        take: 200,
        orderBy: { createdAt: 'desc' },
        select: { date: true, mealType: true, mealName: true, completed: true },
      },
      shoppingHistories: {
        take: 100,
        orderBy: { shoppingDate: 'desc' },
        select: { shoppingDate: true, storeName: true, actualCost: true, estimatedCost: true, durationSeconds: true },
      },
      macroLogs: {
        take: 200,
        orderBy: { date: 'desc' },
        select: { date: true, mealName: true, calories: true, protein: true, carbs: true, fat: true },
      },
      pantryItems: {
        take: 300,
        select: { itemName: true, quantity: true, unit: true, expiresAt: true, category: true },
      },
      activityLogs: {
        take: 300,
        orderBy: { createdAt: 'desc' },
        select: { entityType: true, action: true, metadata: true, createdAt: true },
      },
    },
  });
  if (!user) throw new AppError('User not found', 404);

  const exportsDir = path.resolve('uploads/exports');
  fs.mkdirSync(exportsDir, { recursive: true });

  const filename = `replate-export-${userId}-${Date.now()}.pdf`;
  const filePath = path.join(exportsDir, filename);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const addSection = (title: string) => {
      doc.addPage();
      doc.fontSize(16).fillColor('#111111').font('Helvetica-Bold').text(title);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
    };

    const row = (label: string, value: string | null | undefined) => {
      doc.fontSize(9)
        .fillColor('#555555').text(label + ': ', { continued: true })
        .fillColor('#111111').text(value ?? 'N/A');
    };

    // Cover page
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#111111')
      .text('Replate Nutrition — My Data', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').fillColor('#555555')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`This document contains all personal data stored by Replate Nutrition for`, { align: 'center' });
    doc.text(`${user.fullName} (${user.email}).`, { align: 'center' });

    // Account
    addSection('Account');
    row('Name', user.fullName);
    row('Email', user.email);
    row('User ID', user.id);
    row('Member since', user.createdAt.toLocaleDateString());
    const prefs = user.preferences;
    if (prefs) {
      row('Budget', prefs.budget != null ? `$${prefs.budget}` : null);
      row('ZIP Code', prefs.zipCode);
      row('Household type', prefs.householdType);
      row('Shopping frequency', prefs.shoppingFrequency);
      row('Organizer role', prefs.organizerRole);
    }

    // Profiles
    if (user.profiles.length > 0) {
      addSection('Profiles');
      user.profiles.forEach((p, i) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111').text(`${i + 1}. ${p.name} (${p.type})`);
        doc.font('Helvetica').fontSize(9).fillColor('#333333');
        if (p.petType) row('Pet type', p.petType);
        if (p.criticalAllergies.length) row('Critical allergens', p.criticalAllergies.join(', '));
        if (p.allergies.length) row('Allergies', p.allergies.join(', '));
        if (p.intolerances.length) row('Intolerances', p.intolerances.join(', '));
        if (p.dietaryRestrictions.length) row('Dietary restrictions', p.dietaryRestrictions.join(', '));
        if (p.specialConditions.length) row('Special conditions', p.specialConditions.join(', '));
        if (p.notes) row('Notes', p.notes);
        doc.moveDown(0.5);
      });
    }

    // Meal Plans
    if (user.mealPlans.length > 0) {
      addSection('Meal Plan History');
      user.mealPlans.forEach((m) => {
        const dateStr = m.date instanceof Date ? m.date.toLocaleDateString() : String(m.date);
        doc.fontSize(9).fillColor('#333333')
          .text(`${dateStr} — ${m.mealType}: ${m.mealName}${m.completed ? ' ✓' : ''}`);
      });
    }

    // Shopping History
    if (user.shoppingHistories.length > 0) {
      addSection('Shopping Trips');
      user.shoppingHistories.forEach((h) => {
        const dur = h.durationSeconds ? `${Math.round(h.durationSeconds / 60)}m` : '—';
        const dateStr = h.shoppingDate instanceof Date ? h.shoppingDate.toLocaleDateString() : String(h.shoppingDate);
        doc.fontSize(9).fillColor('#333333')
          .text(`${dateStr} — ${h.storeName} | Actual: $${(h.actualCost ?? 0).toFixed(2)} | Est: $${(h.estimatedCost ?? 0).toFixed(2)} | ${dur}`);
      });
    }

    // Macro Log
    if (user.macroLogs.length > 0) {
      addSection('Nutrition Log');
      user.macroLogs.forEach((ml) => {
        const dateStr = ml.date instanceof Date ? ml.date.toLocaleDateString() : String(ml.date);
        doc.fontSize(9).fillColor('#333333')
          .text(`${dateStr} — ${ml.mealName}: ${ml.calories ?? '?'} kcal | P:${ml.protein ?? '?'}g C:${ml.carbs ?? '?'}g F:${ml.fat ?? '?'}g`);
      });
    }

    // Pantry
    if (user.pantryItems.length > 0) {
      addSection('Pantry');
      user.pantryItems.forEach((p) => {
        const exp = p.expiresAt ? ` (exp: ${new Date(p.expiresAt).toLocaleDateString()})` : '';
        doc.fontSize(9).fillColor('#333333')
          .text(`${p.itemName} — ${p.quantity ?? '?'} ${p.unit ?? ''} [${p.category ?? 'Uncategorized'}]${exp}`);
      });
    }

    // Activity Log
    if (user.activityLogs.length > 0) {
      addSection('Activity Log');
      user.activityLogs.forEach((a) => {
        const meta = a.metadata ? JSON.stringify(a.metadata) : '';
        doc.fontSize(9).fillColor('#333333')
          .text(`${new Date(a.createdAt).toLocaleString()} — ${a.entityType}:${a.action}${meta ? ' ' + meta : ''}`);
      });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/uploads/exports/${filename}`;
}

// ── Public routes ────────────────────────────────────────────────────────────

// POST /api/data-export/request — send verification code (T58)
router.post('/request', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(1).max(300) }).parse(req.body);
    const redis = getRedis();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.setex(exportCodeKey(req.user!.userId), 300, String(code));
    await redis.setex(exportReasonKey(req.user!.userId), 300, String(reason));

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    if (!user) throw new AppError('User not found', 404);

    await sendCodeEmail(user.email, code);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { dataExportRequestedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/data-export/verify — verify code + forward request to admin (T59)
router.post('/verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().trim().length(6) }).parse(req.body);
    const redis = getRedis();
    const storedCode = await redis.get(exportCodeKey(req.user!.userId));
    if (!storedCode || storedCode !== code) throw new AppError('Invalid or expired code', 400);

    const reason = await redis.get(exportReasonKey(req.user!.userId)) ?? 'Not specified';
    await redis.del(exportCodeKey(req.user!.userId));
    await redis.del(exportReasonKey(req.user!.userId));

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    if (!user) throw new AppError('User not found', 404);

    await sendAdminRequestEmail(req.user!.userId, user.email, reason);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/data-export/status — poll export availability (T63)
router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { dataExportUrl: true, dataExportExpiresAt: true, dataExportRequestedAt: true },
    });
    res.json(user ?? { dataExportUrl: null, dataExportExpiresAt: null, dataExportRequestedAt: null });
  } catch (err) { next(err); }
});

// ── Admin route ──────────────────────────────────────────────────────────────

// POST /api/admin/data-export/approve — secured by ADMIN_SECRET (T60-T62)
router.post('/admin/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
      throw new AppError('Forbidden', 403);
    }
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const exportUrl = await buildExportPdf(userId);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { dataExportUrl: exportUrl, dataExportExpiresAt: expiresAt },
    });

    await sendExportReadyEmail(user.email, exportUrl, expiresAt);

    res.json({ ok: true, exportUrl, expiresAt });
  } catch (err) { next(err); }
});

export default router;
