import { randomUUID } from 'crypto';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';
import { AppError } from '../middleware/errorHandler.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Default permissions per role
export function defaultPermissions(role: string) {
  if (role === 'OWNER' || role === 'ADMIN') {
    return { dashboard: true, profiles: true, mealPlan: true, shopping: true, budget: true, recommendations: true, pantry: true, settings: true };
  }
  // MEMBER
  return { dashboard: true, profiles: false, mealPlan: true, shopping: true, budget: false, recommendations: true, pantry: true, settings: false };
}

export async function getOrCreateHousehold(ownerId: string, name?: string) {
  let household = await prisma.household.findUnique({ where: { ownerId }, include: { members: { include: { user: { select: { id: true, email: true, fullName: true } } } } } });
  if (!household) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });
    household = await prisma.household.create({
      data: { name: name || `${owner?.fullName ?? 'My'}'s Household`, ownerId },
      include: { members: { include: { user: { select: { id: true, email: true, fullName: true } } } } },
    });
  }
  return household;
}

export async function getHousehold(ownerId: string) {
  return prisma.household.findUnique({
    where: { ownerId },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, email: true, fullName: true } } },
      },
    },
  });
}

export async function inviteMember(ownerId: string, inviteEmail: string, role: string = 'MEMBER') {
  const household = await getOrCreateHousehold(ownerId);
  const token = randomUUID();
  const perms = defaultPermissions(role);

  // Check if already invited
  const existing = await prisma.householdMember.findFirst({
    where: { householdId: household.id, inviteEmail: inviteEmail.toLowerCase() },
  });
  if (existing) throw new AppError(409, 'This person has already been invited.');

  const member = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      inviteEmail: inviteEmail.toLowerCase(),
      role,
      inviteToken: token,
      permissions: perms,
    },
  });

  const inviteUrl = `${env.FRONTEND_URL}/join?token=${token}`;
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });

  if (resend) {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: env.DEV_EMAIL || inviteEmail,
      subject: `${owner?.fullName ?? 'Someone'} invited you to join their Replate household`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#111">You've been invited!</h2>
          <p style="color:#444"><strong>${owner?.fullName ?? 'A Replate user'}</strong> has invited you to join their household on Replate Nutrition.</p>
          <p style="color:#444">You'll be able to collaborate on meal planning, shopping, and more.</p>
          <a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Accept Invitation</a>
          <p style="color:#888;font-size:12px">Or copy this link: ${inviteUrl}</p>
          <p style="color:#888;font-size:12px">This invitation will not expire unless revoked.</p>
        </div>
      `,
    }).catch(() => {});
  }

  return { ...member, inviteUrl };
}

export async function acceptInvite(token: string, userId: string) {
  const member = await prisma.householdMember.findUnique({ where: { inviteToken: token } });
  if (!member) throw new AppError(404, 'Invite not found or already used.');
  if (member.inviteStatus !== 'PENDING') throw new AppError(400, 'Invite already accepted or declined.');

  await prisma.$transaction([
    prisma.householdMember.update({
      where: { id: member.id },
      data: { userId, inviteStatus: 'ACCEPTED', inviteToken: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { householdId: member.householdId },
    }),
  ]);

  return { householdId: member.householdId };
}

export async function getInviteByToken(token: string) {
  const member = await prisma.householdMember.findUnique({
    where: { inviteToken: token },
    include: { household: { include: { owner: { select: { fullName: true } } } } },
  });
  if (!member) throw new AppError(404, 'Invite not found.');
  return member;
}

export async function removeMember(ownerId: string, memberId: string) {
  const household = await prisma.household.findUnique({ where: { ownerId } });
  if (!household) throw new AppError(404, 'Household not found.');
  const member = await prisma.householdMember.findFirst({ where: { id: memberId, householdId: household.id } });
  if (!member) throw new AppError(404, 'Member not found.');

  await prisma.householdMember.delete({ where: { id: memberId } });
  if (member.userId) {
    await prisma.user.update({ where: { id: member.userId }, data: { householdId: null } }).catch(() => {});
  }
}

export async function updateMemberPermissions(ownerId: string, memberId: string, permissions: Record<string, boolean>) {
  const household = await prisma.household.findUnique({ where: { ownerId } });
  if (!household) throw new AppError(404, 'Household not found.');
  return prisma.householdMember.updateMany({
    where: { id: memberId, householdId: household.id },
    data: { permissions },
  });
}

export async function getMemberPermissions(userId: string) {
  const member = await prisma.householdMember.findUnique({
    where: { userId },
    select: { permissions: true, role: true, householdId: true },
  });
  return member;
}
