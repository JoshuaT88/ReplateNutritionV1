import app from './app.js';
import { env } from './config/env.js';
import { startMealReminderJob } from './jobs/mealReminder.js';
import { startPriceAggregationJob } from './jobs/priceAggregation.js';

const server = app.listen(env.PORT, () => {
  console.log(`Replate Nutrition API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

startPriceAggregationJob();
startMealReminderJob();

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down...');
  server.close(() => process.exit(0));
});
