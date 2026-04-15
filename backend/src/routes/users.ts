import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { emailNotificationsConfigured, sendTestNotificationEmail } from '../services/notification.service.js';

const preferencesUpdateSchema = z.object({
  zipCode: z.string().trim().max(12).nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().max(10).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  firstVisitCompleted: z.boolean().optional(),
  profilePictureUrl: z.string().trim().nullable().optional(),
  householdType: z.string().trim().max(80).nullable().optional(),
  mealReminders: z.boolean().optional(),
  shoppingAlerts: z.boolean().optional(),
  priceDropAlerts: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  emailNotificationsDisclosureAccepted: z.boolean().optional(),
  emailNotificationsDisclosureAcceptedAt: z.string().datetime().nullable().optional(),
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

export default router;
