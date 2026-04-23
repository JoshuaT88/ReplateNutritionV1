/**
 * Resend Webhook Handler
 *
 * Verifies and processes inbound webhook events from Resend (via Svix).
 *
 * ⚠️  IMPORTANT: You must update the webhook URL in your Resend dashboard
 *     (resend.com → Webhooks) to point to your deployed API:
 *
 *       Production:  https://[your-domain]/api/webhooks/resend
 *       Local dev:   http://localhost:3001/api/webhooks/resend
 *                    (use ngrok to expose: ngrok http 3001)
 *
 *     The URL "https://jtctechsoft@gmail.com" you entered is an email address,
 *     not a valid webhook endpoint. Please update it.
 *
 * Signing secret: stored in env.RESEND_WEBHOOK_SECRET (whsec_...)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import { logInfo, logWarn } from '../services/monitoring.service.js';
import prisma from '../config/database.js';

const router = Router();

// Raw body parser — needed for signature verification (MUST come before express.json)
router.use((req: Request, _res, next) => {
  if (req.headers['content-type']?.includes('application/json')) {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      (req as any).rawBody = raw;
      try { (req as any).body = JSON.parse(raw); } catch { /* ignore */ }
      next();
    });
  } else {
    next();
  }
});

function verifyResendSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if not configured

  const msgId = headers['svix-id'] as string;
  const timestamp = headers['svix-timestamp'] as string;
  const sigHeader = headers['svix-signature'] as string;

  if (!msgId || !timestamp || !sigHeader) return false;

  // Reject requests older than 5 minutes
  const tsMs = parseInt(timestamp, 10) * 1000;
  if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return false;

  const toSign = `${msgId}.${timestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const computed = createHmac('sha256', secretBytes).update(toSign).digest('base64');

  const signatures = sigHeader.split(' ');
  return signatures.some((sig) => {
    const [version, value] = sig.split(',');
    if (version !== 'v1' || !value) return false;
    try {
      return timingSafeEqual(Buffer.from(computed), Buffer.from(value));
    } catch {
      return false;
    }
  });
}

router.post('/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!verifyResendSignature(rawBody, req.headers as any)) {
      logWarn('[Webhook] Invalid Resend signature', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    logInfo(`[Webhook/Resend] ${event.type}`, { emailId: event.data?.email_id });

    switch (event.type) {
      case 'email.delivered':
        // Email confirmed delivered — no action needed beyond logging
        break;

      case 'email.bounced':
      case 'email.delivery_delayed': {
        // Optionally disable notifications for that email address
        const toEmail = event.data?.to?.[0];
        if (toEmail) {
          await prisma.userPreferences.updateMany({
            where: { user: { email: toEmail } },
            data: { emailNotificationsEnabled: false },
          }).catch(() => {}); // fire-and-forget, don't break the webhook ack
          logWarn(`[Webhook/Resend] Email ${event.type} for ${toEmail} — notifications disabled`);
        }
        break;
      }

      case 'email.complained': {
        // Spam complaint — disable notifications immediately
        const toEmail = event.data?.to?.[0];
        if (toEmail) {
          await prisma.userPreferences.updateMany({
            where: { user: { email: toEmail } },
            data: { emailNotificationsEnabled: false, emailNotificationsDisclosureAccepted: false },
          }).catch(() => {});
          logWarn(`[Webhook/Resend] Spam complaint from ${toEmail} — notifications disabled`);
        }
        break;
      }

      default:
        // Unknown event type — just acknowledge
        break;
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
