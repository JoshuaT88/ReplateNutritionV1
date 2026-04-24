import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { trackActivity, getHealthSnapshot } from './services/monitoring.service.js';
import { verifyAccessToken } from './utils/jwt.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import profileRoutes from './routes/profiles.js';
import recommendationRoutes from './routes/recommendations.js';
import mealPlanRoutes from './routes/mealPlan.js';
import shoppingRoutes from './routes/shopping.js';
import shoppingHistoryRoutes from './routes/shoppingHistory.js';
import pricingRoutes from './routes/pricing.js';
import aisleRoutes from './routes/aisles.js';
import supportRoutes from './routes/support.js';
import macroRoutes from './routes/macros.js';
import pushRoutes from './routes/push.js';
import shareRoutes from './routes/share.js';
import webhookRoutes from './routes/webhooks.js';
import pantryRoutes from './routes/pantry.js';
import recipeRoutes from './routes/recipes.js';
import shoppingGroupRoutes from './routes/shoppingGroups.js';
import activityRoutes from './routes/activity.js';
import householdRoutes, { createPreviewRouter } from './routes/household.js';
import dataExportRoutes from './routes/dataExport.js';
import { type AuthRequest } from './middleware/auth.js';

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.resolve('uploads/receipts');
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", env.FRONTEND_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter(200, 60_000));

// Track activity for any authenticated request (fire-and-forget)
app.use((req: AuthRequest, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      if (payload?.userId) trackActivity(payload.userId);
    } catch { /* token may be invalid — auth middleware handles it */ }
  }
  next();
});

app.use('/uploads', express.static('uploads'));

app.get('/api/health', (_req, res) => {
  res.json(getHealthSnapshot());
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/meal-plan', mealPlanRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/shopping/history', shoppingHistoryRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/aisles', aisleRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/macros', macroRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping-groups', shoppingGroupRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/household', householdRoutes);
app.use('/api/household', createPreviewRouter());
app.use('/api/data-export', dataExportRoutes);

app.use(errorHandler);

export default app;
