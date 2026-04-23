import app from './app.js';
import { env } from './config/env.js';
import { startMealReminderJob } from './jobs/mealReminder.js';
import { startPriceAggregationJob } from './jobs/priceAggregation.js';
import { reportError } from './services/monitoring.service.js';

const server = app.listen(env.PORT, () => {
  console.log(`Replate Nutrition API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

startPriceAggregationJob();
startMealReminderJob();

// Global crash handlers — alert dev before dying
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  reportError(err, { route: 'process.uncaughtException' }).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[FATAL] Unhandled rejection:', err);
  reportError(err, { route: 'process.unhandledRejection' }).catch(() => {});
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down...');
  server.close(() => process.exit(0));
});
