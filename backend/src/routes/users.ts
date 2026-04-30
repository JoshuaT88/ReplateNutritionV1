import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { Resend } from 'resend';
import { AppError } from '../middleware/errorHandler.js';
import { emailNotificationsConfigured, sendTestNotificationEmail } from '../services/notification.service.js';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const preferencesUpdateSchema = z.object({
  zipCode: z.string().trim().max(12).nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().max(10).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  firstVisitCompleted: z.boolean().optional(),
  profilePictureUrl: z.string().trim().nullable().optional(),
  householdType: z.string().trim().max(80).nullable().optional(),
  mealReminders: z.boolean().optional(),
  shoppingAlerts: z.boolean().optional(),
  priceDropAlerts: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  emailNotificationsDisclosureAccepted: z.boolean().optional(),
  emailNotificationsDisclosureAcceptedAt: z.string().datetime().nullable().optional(),
  gpsAppPreference: z.enum(['google', 'apple', 'waze', 'system']).nullable().optional(),
  preferredStoreIds: z.array(z.string().max(200)).max(10).nullable().optional(),
  pinnedNavItems: z.array(z.string().max(40)).max(4).nullable().optional(),
  shoppingFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'custom']).nullable().optional(),
  shoppingDay: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).nullable().optional(),
  perTripBudgetAllocation: z.number().nonnegative().nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().length(2).toUpperCase().nullable().optional(),
});

const router = Router();
router.use(authenticate);

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.put('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { fullName },
      select: { id: true, email: true, fullName: true, role: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.get('/me/preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { userId: req.user!.userId },
      });
    }
    res.json(prefs);
  } catch (err) { next(err); }
});

router.put('/me/preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.userId },
    });

    const parsed = preferencesUpdateSchema.parse(req.body);

    const updateData: Record<string, unknown> = {
      ...parsed,
    };

    if (Object.prototype.hasOwnProperty.call(parsed, 'zipCode')) {
      updateData.zipCode = parsed.zipCode?.trim() ? parsed.zipCode.trim() : null;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'city')) {
      updateData.city = parsed.city?.trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'state')) {
      updateData.state = parsed.state?.trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'householdType')) {
      updateData.householdType = parsed.householdType?.trim() ? parsed.householdType.trim() : null;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'profilePictureUrl')) {
      updateData.profilePictureUrl = parsed.profilePictureUrl?.trim() ? parsed.profilePictureUrl.trim() : null;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'emailNotificationsDisclosureAcceptedAt')) {
      updateData.emailNotificationsDisclosureAcceptedAt = parsed.emailNotificationsDisclosureAcceptedAt
        ? new Date(parsed.emailNotificationsDisclosureAcceptedAt)
        : null;
    }

    if (parsed.emailNotificationsDisclosureAccepted === false) {
      updateData.emailNotificationsEnabled = false;
      updateData.emailNotificationsDisclosureAcceptedAt = null;
    }

    const disclosureAccepted = parsed.emailNotificationsDisclosureAccepted
      ?? existing?.emailNotificationsDisclosureAccepted
      ?? false;

    const disclosureAcceptedAt = (updateData.emailNotificationsDisclosureAcceptedAt as Date | null | undefined)
      ?? existing?.emailNotificationsDisclosureAcceptedAt
      ?? null;

    if (parsed.emailNotificationsDisclosureAccepted === true && !disclosureAcceptedAt) {
      updateData.emailNotificationsDisclosureAcceptedAt = new Date();
    }

    if (parsed.emailNotificationsEnabled === true && (!disclosureAccepted || !((updateData.emailNotificationsDisclosureAcceptedAt as Date | null | undefined) ?? existing?.emailNotificationsDisclosureAcceptedAt))) {
      throw new AppError(400, 'You must accept the email notification disclosure before enabling email notifications.');
    }

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.userId },
      update: updateData,
      create: { userId: req.user!.userId, ...updateData },
    });
    res.json(prefs);
  } catch (err) { next(err); }
});

// Manual budget period reset — sets budgetLastResetAt to now so monthly spending is recalculated from this point
router.post('/me/preferences/budget/reset', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.userId },
      update: { budgetLastResetAt: new Date() },
      create: { userId: req.user!.userId, budgetLastResetAt: new Date() },
    });
    res.json({ budgetLastResetAt: prefs.budgetLastResetAt });
  } catch (err) { next(err); }
});

router.post('/me/preferences/test-email', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!emailNotificationsConfigured()) {
      throw new AppError(503, 'Email notifications are not configured on the server yet.');
    }

    const [user, prefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { email: true, fullName: true },
      }),
      prisma.userPreferences.findUnique({
        where: { userId: req.user!.userId },
      }),
    ]);

    if (!user) throw new AppError(404, 'User not found');

    if (!prefs?.emailNotificationsEnabled || !prefs.emailNotificationsDisclosureAccepted) {
      throw new AppError(400, 'Enable email notifications and accept the disclosure before sending a test email.');
    }

    await sendTestNotificationEmail({
      email: user.email,
      fullName: user.fullName,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/me/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, 'Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/me/export', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [user, preferences, profiles, recommendations, mealPlans, shoppingList, shoppingHistory] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, createdAt: true } }),
      prisma.userPreferences.findUnique({ where: { userId } }),
      prisma.profile.findMany({ where: { userId } }),
      prisma.recommendation.findMany({ where: { userId } }),
      prisma.mealPlan.findMany({ where: { userId } }),
      prisma.shoppingList.findMany({ where: { userId } }),
      prisma.shoppingHistory.findMany({ where: { userId } }),
    ]);
    res.json({ user, preferences, profiles, recommendations, mealPlans, shoppingList, shoppingHistory, exportedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.delete('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({ where: { id: req.user!.userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Email verification code endpoints (T16) ─────────────────────────────────

router.post('/me/preferences/request-email-verification', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
    if (!user) throw new AppError(404, 'User not found');

    // Delete any existing unused codes for this user/purpose
    await prisma.emailVerificationCode.deleteMany({
      where: { userId, purpose: 'notifications', usedAt: null },
    });

    // Generate a 6-digit code using a cryptographically secure method
    const codeNum = crypto.randomInt(100000, 1000000);
    const code = codeNum.toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.emailVerificationCode.create({
      data: { userId, code, purpose: 'notifications', expiresAt },
    });

    // In dev without Resend configured, log the code to console so it can still be tested
    if (!resend || !env.FROM_EMAIL) {
      if (env.NODE_ENV !== 'production') {
        console.log(`[DEV] Email verification code for ${user.email}: ${code}`);
        return res.json({ sent: true, devCode: code });
      }
      throw new AppError(503, 'Email service is not configured on this server.');
    }

    const toEmail = env.NODE_ENV === 'production' ? user.email : (env.DEV_EMAIL || user.email);

    const { error: sendError } = await resend.emails.send({
      from: env.FROM_EMAIL,
      to: toEmail,
      subject: 'Your Replate verification code',
      html: `
        <div style="background-color:#ffffff;font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#0F172A;font-size:22px;margin-bottom:8px;">Email Verification</h2>
          <p style="color:#374151;font-size:15px;margin-bottom:24px;">
            Use the code below to verify your email for Replate notifications. It expires in 5 minutes.
          </p>
          <div style="background:#F1F5F9;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#3B82F6;">${code}</span>
          </div>
          <p style="color:#6B7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (sendError) {
      console.error('[Email] Verification send failed:', sendError);
      if (env.NODE_ENV !== 'production') {
        console.log(`[DEV] Verification code fallback for ${user.email}: ${code}`);
        return res.json({ sent: true, devCode: code });
      }
      throw new AppError(502, `Failed to send verification email: ${sendError.message}`);
    }

    res.json({ sent: true });
  } catch (err) { next(err); }
});

router.post('/me/preferences/verify-email-code', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { code } = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);

    const record = await prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        purpose: 'notifications',
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) throw new AppError(400, 'Invalid or expired verification code.');

    // Mark as used
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Enable email notifications
    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        emailNotificationsEnabled: true,
        emailNotificationsDisclosureAccepted: true,
        emailNotificationsDisclosureAcceptedAt: new Date(),
      },
      create: {
        userId,
        emailNotificationsEnabled: true,
        emailNotificationsDisclosureAccepted: true,
        emailNotificationsDisclosureAcceptedAt: new Date(),
      },
    });

    res.json({ success: true, preferences: prefs });
  } catch (err) { next(err); }
});

router.post('/me/change-email-request', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { newEmail } = z.object({ newEmail: z.string().email() }).parse(req.body);
    const userId = req.user!.userId;

    // Check new email not already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) throw new AppError(400, 'That email address is already in use.');

    if (!resend || !env.FROM_EMAIL) throw new AppError(503, 'Email service is not configured on this server.');

    // Delete any existing change-email codes for this user
    await prisma.emailVerificationCode.deleteMany({
      where: { userId, purpose: { startsWith: 'change_email:' }, usedAt: null },
    });

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.emailVerificationCode.create({
      data: { userId, code, purpose: `change_email:${newEmail}`, expiresAt },
    });

    const toEmail = env.NODE_ENV === 'production' ? newEmail : (env.DEV_EMAIL || newEmail);
    const { error: sendError } = await resend.emails.send({
      from: env.FROM_EMAIL,
      to: toEmail,
      subject: 'Confirm your new Replate email address',
      html: `
        <div style="background-color:#ffffff;font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <div style="border:1px solid #E2E8F0;border-radius:16px;padding:28px;background-color:#ffffff;">
            <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;margin:0 0 10px;">Replate Nutrition</p>
            <h2 style="color:#0F172A;font-size:22px;margin:0 0 8px;">Confirm Email Change</h2>
            <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Enter this code in Replate to confirm your new email address. It expires in 10 minutes.
            </p>
            <div style="background:#F1F5F9;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#3B82F6;">${code}</span>
            </div>
            <p style="color:#6B7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });
    if (sendError) {
      console.error('[Email] Change-email send failed:', sendError);
      if (env.NODE_ENV !== 'production') console.log(`[DEV] Change-email code for ${newEmail}: ${code}`);
      else throw new AppError(502, `Failed to send confirmation email: ${sendError.message}`);
    }

    res.json({ sent: true });
  } catch (err) { next(err); }
});

router.post('/me/change-email-confirm', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
    const userId = req.user!.userId;

    const record = await prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        purpose: { startsWith: 'change_email:' },
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) throw new AppError(400, 'Invalid or expired verification code.');

    const newEmail = record.purpose.replace('change_email:', '');

    // Confirm email not already taken (race condition guard)
    const conflict = await prisma.user.findUnique({ where: { email: newEmail } });
    if (conflict && conflict.id !== userId) throw new AppError(400, 'That email address is already in use.');

    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await prisma.user.update({ where: { id: userId }, data: { email: newEmail } });

    res.json({ success: true, email: newEmail });
  } catch (err) { next(err); }
});

export default router;
