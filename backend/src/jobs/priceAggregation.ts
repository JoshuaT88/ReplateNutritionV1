import cron from 'node-cron';
import { aggregatePrices } from '../services/pricing.service.js';

export function startPriceAggregationJob() {
  // Run nightly at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting nightly price aggregation...');
    try {
      const result = await aggregatePrices();
      console.log(`[CRON] Price aggregation complete. Processed ${result.groupsProcessed} groups.`);
    } catch (err) {
      console.error('[CRON] Price aggregation failed:', err);
    }
  });

  console.log('[CRON] Price aggregation job scheduled (nightly at 2:00 AM)');
}
