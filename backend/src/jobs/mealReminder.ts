import cron from 'node-cron';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { emailNotificationsConfigured, sendMealReminderEmail } from '../services/notification.service.js';

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

      console.log(`[CRON] Meal reminder job complete. Sent ${sentCount} email(s).`);
    } catch (err) {
      console.error('[CRON] Meal reminder job failed:', err);
    }
  });

  console.log(`[CRON] Meal reminder job scheduled (${schedule})`);
}