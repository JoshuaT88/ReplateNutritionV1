import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY!,

  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@replatenutrition.com',
  MEAL_REMINDER_CRON: process.env.MEAL_REMINDER_CRON || '0 7 * * *',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
} as const;
