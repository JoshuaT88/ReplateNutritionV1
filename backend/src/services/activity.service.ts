import prisma from '../config/database.js';

export interface LogActivityInput {
  userId: string;
  profileId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      userId: input.userId,
      profileId: input.profileId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      performedBy: input.performedBy ?? null,
      metadata: input.metadata ? (input.metadata as object) : undefined,
    },
  });
}

export async function getActivity(
  userId: string,
  opts: { profileId?: string; entityType?: string; from?: string; to?: string; limit?: number }
) {
  const where: Record<string, unknown> = { userId };

  if (opts.profileId) where.profileId = opts.profileId;
  if (opts.entityType) where.entityType = opts.entityType;

  if (opts.from || opts.to) {
    const createdAt: Record<string, Date> = {};
    if (opts.from) createdAt.gte = new Date(opts.from);
    if (opts.to) createdAt.lte = new Date(opts.to);
    where.createdAt = createdAt;
  }

  return prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 50, 200),
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      performedBy: true,
      metadata: true,
      createdAt: true,
      profileId: true,
      profile: {
        select: { id: true, name: true, petType: true },
      },
    },
  });
}
