import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import profileRoutes from './routes/profiles.js';
import recommendationRoutes from './routes/recommendations.js';
import mealPlanRoutes from './routes/mealPlan.js';
import shoppingRoutes from './routes/shopping.js';
import shoppingHistoryRoutes from './routes/shoppingHistory.js';
import pricingRoutes from './routes/pricing.js';
import aisleRoutes from './routes/aisles.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter(200, 60_000));

app.use('/uploads', express.static('uploads'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.use(errorHandler);

export default app;
