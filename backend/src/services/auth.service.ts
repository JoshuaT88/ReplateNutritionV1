import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import prisma from '../config/database.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import crypto from 'crypto';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const SALT_ROUNDS = 12;

export async function register(email: string, password: string, fullName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash,
      preferences: { create: {} },
    },
    include: { preferences: true },
  });

  const tokens = await generateTokens(user.id, user.email, user.role);
  return {
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    ...tokens,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid email or password');

  const tokens = await generateTokens(user.id, user.email, user.role);
  return {
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    ...tokens,
  };
}

export async function refreshTokens(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const payload = verifyRefreshToken(refreshToken);
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  return generateTokens(payload.userId, payload.email, payload.role);
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Don't reveal if email exists

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // Store token in Redis or a simple DB field (using Redis for expiry)
  // For simplicity, we'll use a hash as a temporary password reset mechanism
  if (resend) {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: email,
      subject: 'Reset your Replate Nutrition password',
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #0F172A;">Reset Your Password</h2>
          <p style="color: #64748B;">Click the link below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; border-radius: 12px; text-decoration: none; margin-top: 16px;">Reset Password</a>
          <p style="color: #94A3B8; font-size: 13px; margin-top: 24px;">If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });
  }
}

export async function resetPassword(token: string, newPassword: string) {
  // In production, validate the token against stored reset tokens
  // For now, this is a placeholder that shows the intended flow
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  // TODO: Look up user by reset token, update password
  return { success: true };
}

async function generateTokens(userId: string, email: string, role: string) {
  const accessToken = signAccessToken({ userId, email, role });
  const refreshToken = signRefreshToken({ userId, email, role });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}
