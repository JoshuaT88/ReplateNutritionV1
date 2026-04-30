import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as householdService from '../services/household.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET /api/household — get my household
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const h = await householdService.getHousehold(req.user!.userId);
    res.json(h ?? null);
  } catch (err) { next(err); }
});

// POST /api/household — create/get household with optional name
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().max(100).optional() }).parse(req.body);
    const h = await householdService.getOrCreateHousehold(req.user!.userId, name);
    res.status(201).json(h);
  } catch (err) { next(err); }
});

// POST /api/household/invite
router.post('/invite', async (req: AuthRequest, res, next) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    }).parse(req.body);
    const result = await householdService.inviteMember(req.user!.userId, email, role);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/household/invite/preview?token=xxx — get invite details without accepting (no auth required)
// We handle this below with a separate unauthenticated handler

// DELETE /api/household/members/:memberId — remove a member
router.delete('/members/:memberId', async (req: AuthRequest, res, next) => {
  try {
    await householdService.removeMember(req.user!.userId, String(req.params.memberId));
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/household/members/:memberId/permissions
router.patch('/members/:memberId/permissions', async (req: AuthRequest, res, next) => {
  try {
    const permissions = z.record(z.boolean()).parse(req.body.permissions);
    await householdService.updateMemberPermissions(req.user!.userId, String(req.params.memberId), permissions);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/household/accept — accept invite (authenticated: must already have an account)
router.post('/accept', async (req: AuthRequest, res, next) => {
  try {
    const { token } = z.object({ token: z.string().uuid() }).parse(req.body);
    const result = await householdService.acceptInvite(token, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/household/permissions — get my permissions as a member
router.get('/permissions', async (req: AuthRequest, res, next) => {
  try {
    const member = await householdService.getMemberPermissions(req.user!.userId);
    res.json(member ?? null);
  } catch (err) { next(err); }
});

export default router;

// ---- Unauthenticated preview route (exported separately for app.ts) ----
export function createPreviewRouter() {
  const r = Router();
  r.get('/invite/preview', async (req, res, next) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : undefined;
      if (!token) throw new AppError(400, 'token required');
      const member = await householdService.getInviteByToken(token);
      res.json({
        householdName: (member as any).household?.name,
        ownerName: (member as any).household?.owner?.fullName,
        inviteEmail: member.inviteEmail,
        role: member.role,
        status: member.inviteStatus,
      });
    } catch (err) { next(err); }
  });
  return r;
}
