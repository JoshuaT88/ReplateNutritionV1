import cron from 'node-cron';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { emailNotificationsConfigured, sendMealReminderEmail } from '../services/notification.service.js';
import { sendPushToUser } from '../services/push.service.js';

export function startMealReminderJob() {
  const schedule = env.MEAL_REMINDER_CRON;

  cron.schedule(schedule, async () => {
    if (!emailNotificationsConfigured()) {
      console.log('[CRON] Meal reminders skipped: RESEND_API_KEY not configured');
      return;
    }

    console.log('[CRON] Starting meal reminder job...');

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      const recipients = await prisma.userPreferences.findMany({
        where: {
          emailNotificationsEnabled: true,
          emailNotificationsDisclosureAccepted: true,
          mealReminders: true,
          emailNotificationsDisclosureAcceptedAt: { not: null },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      let sentCount = 0;

      for (const prefs of recipients) {
        const meals = await prisma.mealPlan.findMany({
          where: {
            userId: prefs.userId,
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          orderBy: [
            { date: 'asc' },
            { mealType: 'asc' },
          ],
          include: {
            profile: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        });

        if (!meals.length) {
          continue;
        }

        await sendMealReminderEmail(
          {
            email: prefs.user.email,
            fullName: prefs.user.fullName,
          },
          meals.map((meal) => ({
            mealName: meal.mealName,
            mealType: meal.mealType,
            profile: meal.profile,
          }))
        );

        sentCount++;
      }

      // Also fire push notifications for users who have push subscriptions
      const allRecipientIds = recipients.map((p) => p.userId);
      for (const userId of allRecipientIds) {
        const meals = await prisma.mealPlan.findMany({
          where: { userId, date: { gte: startOfDay, lte: endOfDay } },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
        });
        if (!meals.length) continue;
        const mealNames = meals.slice(0, 3).map((m) => m.mealName).join(', ');
        await sendPushToUser(userId, {
          title: "Today's meals are planned",
          body: mealNames + (meals.length > 3 ? ` +${meals.length - 3} more` : ''),
          data: { type: 'meal_reminder', url: '/meal-plan' },
        }).catch((err) => console.error('[Push] Meal reminder failed for', userId, err));
      }

      console.log(`[CRON] Meal reminder job complete. Sent ${sentCount} email(s).`);
    } catch (err) {
      console.error('[CRON] Meal reminder job failed:', err);
    }
  });

  console.log(`[CRON] Meal reminder job scheduled (${schedule})`);
}