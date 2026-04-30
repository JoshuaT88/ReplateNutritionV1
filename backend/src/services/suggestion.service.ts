import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './inAppNotification.service.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export type SuggestionType = 'meal' | 'shopping_item';
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export async function createSuggestion(
  requestedByUserId: string,
  type: SuggestionType,
  title: string,
  details?: string
) {
  // Member must belong to a household
  const membership = await prisma.householdMember.findUnique({
    where: { userId: requestedByUserId },
    include: { household: { include: { owner: { select: { id: true, email: true, fullName: true } } } } },
  });
  if (!membership || membership.inviteStatus !== 'ACCEPTED') {
    throw new AppError(403, 'You must be an accepted household member to submit suggestions.');
  }

  const suggestion = await prisma.familyMemberSuggestion.create({
    data: {
      householdId: membership.householdId,
      requestedByUserId,
      type,
      title,
      details: details ?? null,
    },
  });

  // Notify the household owner (in-app + push)
  const requester = await prisma.user.findUnique({
    where: { id: requestedByUserId },
    select: { fullName: true },
  });
  await createNotification({
    userId: membership.household.owner.id,
    type: 'suggestion_pending',
    title: `New ${type === 'meal' ? 'meal suggestion' : 'shopping request'}`,
    body: `${requester?.fullName ?? 'A family member'} requested: ${title}`,
    metadata: { suggestionId: suggestion.id, type },
  });

  return suggestion;
}

export async function getSuggestions(householdOwnerId: string) {
  const household = await prisma.household.findUnique({ where: { ownerId: householdOwnerId } });
  if (!household) return [];

  return prisma.familyMemberSuggestion.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: 'desc' },
    include: {
      requestedByUser: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function getMySuggestions(userId: string) {
  return prisma.familyMemberSuggestion.findMany({
    where: { requestedByUserId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function reviewSuggestion(
  householdOwnerId: string,
  suggestionId: string,
  status: SuggestionStatus,
  adminNotes?: string
) {
  const household = await prisma.household.findUnique({ where: { ownerId: householdOwnerId } });
  if (!household) throw new AppError(404, 'Household not found.');

  const suggestion = await prisma.familyMemberSuggestion.findFirst({
    where: { id: suggestionId, householdId: household.id },
    include: { requestedByUser: { select: { id: true, email: true, fullName: true } } },
  });
  if (!suggestion) throw new AppError(404, 'Suggestion not found.');

  const updated = await prisma.familyMemberSuggestion.update({
    where: { id: suggestionId },
    data: { status, adminNotes: adminNotes ?? null },
  });

  const verb = status === 'APPROVED' ? 'approved' : 'declined';
  const notifTitle = `Your ${suggestion.type === 'meal' ? 'meal suggestion' : 'shopping request'} was ${verb}`;

  // In-app notification to the requester
  await createNotification({
    userId: suggestion.requestedByUser.id,
    type: status === 'APPROVED' ? 'suggestion_approved' : 'suggestion_denied',
    title: notifTitle,
    body: adminNotes
      ? `"${suggestion.title}" — Note: ${adminNotes}`
      : `"${suggestion.title}"`,
    metadata: { suggestionId, status },
  });

  // Soft email to requester if Resend configured
  if (resend && env.FROM_EMAIL) {
    const toEmail = env.NODE_ENV === 'production'
      ? suggestion.requestedByUser.email
      : (env.DEV_EMAIL || suggestion.requestedByUser.email);

    const firstName = suggestion.requestedByUser.fullName.split(' ')[0];
    const statusColor = status === 'APPROVED' ? '#059669' : '#DC2626';
    const statusLabel = status === 'APPROVED' ? 'Approved ✓' : 'Declined';

    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: toEmail,
      subject: `Update on your ${suggestion.type === 'meal' ? 'meal suggestion' : 'shopping request'} — Replate`,
      html: `
        <div style="background-color:#ffffff;font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
          <div style="border:1px solid #E2E8F0;border-radius:16px;padding:28px;background-color:#ffffff;">
            <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;margin:0 0 10px;">Replate Nutrition</p>
            <h2 style="color:#0F172A;font-size:22px;margin:0 0 8px;">Request Update</h2>
            <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Hi ${firstName}, your ${suggestion.type === 'meal' ? 'meal suggestion' : 'shopping request'} has been reviewed.
            </p>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin:0 0 16px;">
              <p style="color:#64748B;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Request</p>
              <p style="color:#0F172A;font-size:15px;font-weight:600;margin:0 0 8px;">${suggestion.title}</p>
              <p style="color:${statusColor};font-size:14px;font-weight:600;margin:0;">${statusLabel}</p>
              ${adminNotes ? `<p style="color:#475569;font-size:13px;margin:8px 0 0;"><strong>Note:</strong> ${adminNotes}</p>` : ''}
            </div>
            <a href="${env.FRONTEND_URL}/household" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View My Requests</a>
          </div>
        </div>
      `,
    }).catch((err: Error) => console.error('[Email] Suggestion notification failed:', err));
  }

  return updated;
}
