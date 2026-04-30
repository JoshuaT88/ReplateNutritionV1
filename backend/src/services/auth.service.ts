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
  if (!user) return; // Don't reveal whether email exists

  // Expire any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt,
    },
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  if (resend) {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: email,
      subject: 'Reset your Replate Nutrition password',
      html: `
        <div style="background-color:#ffffff;font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <div style="border:1px solid #E2E8F0;border-radius:16px;padding:28px;background-color:#ffffff;">
            <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;margin:0 0 10px;">Replate Nutrition</p>
            <h2 style="color:#0F172A;font-size:22px;margin:0 0 12px;">Reset Your Password</h2>
            <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
            <p style="color:#6B7280;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });
  }
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token || !newPassword) throw new AppError(400, 'Token and new password are required');
  if (newPassword.length < 8) throw new AppError(400, 'Password must be at least 8 characters');

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record) throw new AppError(400, 'Invalid or expired reset link. Please request a new one.');
  if (record.usedAt) throw new AppError(400, 'This reset link has already been used.');
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    throw new AppError(400, 'Reset link has expired. Please request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Use a transaction: mark token as used + update password atomically
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // Invalidate all existing refresh tokens for this user (force re-login)
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);

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
