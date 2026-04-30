import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { invalidateRecCache } from './recommendation.service.js';

export async function getProfiles(userId: string) {
  return prisma.profile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });
  if (!profile) throw new AppError(404, 'Profile not found');
  return profile;
}

export async function createProfile(userId: string, data: any) {
  return prisma.profile.create({
    data: { ...data, userId },
  });
}

export async function updateProfile(userId: string, profileId: string, data: any) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });
  if (!profile) throw new AppError(404, 'Profile not found');

  const updated = await prisma.profile.update({
    where: { id: profileId },
    data,
  });
  invalidateRecCache(profileId).catch(() => {});
  return updated;
}

export async function deleteProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });
  if (!profile) throw new AppError(404, 'Profile not found');

  await prisma.profile.delete({ where: { id: profileId } });
}
