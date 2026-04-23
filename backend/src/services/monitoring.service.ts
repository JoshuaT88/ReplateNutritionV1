/**
 * Monitoring Service
 *
 * Provides:
 *  - Active user tracking (in-memory, counts concurrent users)
 *  - Tiered error/warn/info logging with dev email alerts for error + fatal
 *  - User-initiated issue reporting (sent directly to dev email)
 *  - Structured error logging with request context
 *
 * Alert tiers:
 *   info  → console only
 *   warn  → console + email (debounced, production only)
 *   error → console + email (debounced, production only)
 *   fatal → console + email (always, no debounce)
 *
 * All alerts go to env.DEV_EMAIL (jtctechsoft@gmail.com).
 */

import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// ---------------------------------------------------------------------------
// Active User Tracking
// ---------------------------------------------------------------------------

// userId → ISO timestamp of last activity
const activeUsers = new Map<string, string>();

/** Call this when a user makes any authenticated request. */
export function trackActivity(userId: string) {
  activeUsers.set(userId, new Date().toISOString());
}

/** Remove user from the active set (on logout). */
export function removeActiveUser(userId: string) {
  activeUsers.delete(userId);
}

/** Returns how many users have been active in the last N minutes. */
export function getActiveUserCount(withinMinutes = 15): number {
  const cutoff = Date.now() - withinMinutes * 60_000;
  let count = 0;
  for (const ts of activeUsers.values()) {
    if (new Date(ts).getTime() >= cutoff) count++;
  }
  return count;
}

/** Prune stale entries (call periodically, e.g., hourly). */
export function pruneInactiveUsers(olderThanMinutes = 60) {
  const cutoff = Date.now() - olderThanMinutes * 60_000;
  for (const [userId, ts] of activeUsers.entries()) {
    if (new Date(ts).getTime() < cutoff) activeUsers.delete(userId);
  }
}

// Run pruning every hour automatically
setInterval(() => pruneInactiveUsers(), 60 * 60_000);

// ---------------------------------------------------------------------------
// Error Alert Debouncing
// ---------------------------------------------------------------------------

// Tracks recently sent alert signatures to avoid flooding dev inbox
const recentAlerts = new Map<string, number>(); // signature → timestamp
const ALERT_COOLDOWN_MS = 15 * 60_000; // one alert per signature per 15 min

function getErrorSignature(err: Error, context?: string): string {
  const msg = err.message?.slice(0, 100) || 'unknown';
  const stack = err.stack?.split('\n')[1]?.trim() || '';
  return `${context || 'app'}::${msg}::${stack}`;
}

function shouldSendAlert(signature: string): boolean {
  const last = recentAlerts.get(signature);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false;
  recentAlerts.set(signature, Date.now());
  return true;
}

// ---------------------------------------------------------------------------
// Error Reporting
// ---------------------------------------------------------------------------

export interface ErrorContext {
  route?: string;
  method?: string;
  userId?: string;
  ip?: string;
  body?: string;
  [key: string]: unknown;
}

export async function reportError(err: Error, context?: ErrorContext): Promise<void> {
  const isProduction = env.NODE_ENV === 'production';

  // Always log to console
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    ...(context ?? {}),
  });

  // Only email in production and only if configured
  if (!isProduction || !resend || !env.DEV_EMAIL) return;

  const signature = getErrorSignature(err, context?.route);
  if (!shouldSendAlert(signature)) return;

  const activeCount = getActiveUserCount();
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

  const contextRows = context
    ? Object.entries(context)
        .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#64748B;font-size:13px;">${k}</td><td style="padding:4px 8px;font-size:13px;font-family:monospace;">${String(v ?? '—')}</td></tr>`)
        .join('')
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#0F172A;">
      <div style="border:1px solid #FCA5A5;border-radius:16px;padding:24px;background:#FFF7F7;">
        <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#EF4444;margin:0 0 8px;">Replate Nutrition — Error Alert</p>
        <h2 style="font-size:20px;margin:0 0 12px;color:#0F172A;">Unhandled Server Error</h2>
        <p style="color:#475569;margin:0 0 16px;font-size:14px;">${now} · ${activeCount} active user${activeCount !== 1 ? 's' : ''} online</p>

        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:14px;margin-bottom:16px;">
          <p style="font-size:13px;font-weight:600;margin:0 0 6px;color:#B91C1C;">${err.name}: ${err.message}</p>
          <pre style="font-size:11px;white-space:pre-wrap;word-break:break-all;color:#7F1D1D;margin:0;">${(err.stack || '').slice(0, 1200)}</pre>
        </div>

        ${contextRows ? `
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr><th colspan="2" style="text-align:left;padding:4px 8px;font-size:12px;color:#64748B;border-bottom:1px solid #E2E8F0;">Request Context</th></tr></thead>
          <tbody>${contextRows}</tbody>
        </table>` : ''}

        <a href="${env.FRONTEND_URL}" style="display:inline-block;padding:10px 16px;background:#1E293B;color:white;border-radius:10px;text-decoration:none;font-size:13px;">Open App Dashboard</a>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: env.DEV_EMAIL,
      subject: `[Replate Error] ${err.name}: ${err.message.slice(0, 60)}`,
      html,
    });
  } catch (emailErr) {
    // Do NOT throw — monitoring must never break the app
    console.error('[Monitoring] Failed to send error email:', emailErr);
  }
}

// ---------------------------------------------------------------------------
// Health Snapshot
// ---------------------------------------------------------------------------

export function getHealthSnapshot() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeUsers: getActiveUserCount(),
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    env: env.NODE_ENV,
  };
}

// ---------------------------------------------------------------------------
// Tiered Logging
// ---------------------------------------------------------------------------

/** Log an info-level message (console only). */
export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info('[INFO]', message, meta ?? '');
}

/** Log a warning — console always, email in production (debounced). */
export async function logWarn(message: string, meta?: Record<string, unknown>) {
  console.warn('[WARN]', message, meta ?? '');
  if (env.NODE_ENV !== 'production' || !resend || !env.DEV_EMAIL) return;

  const fakeErr = new Error(message);
  const signature = getErrorSignature(fakeErr, 'warn');
  if (!shouldSendAlert(signature)) return;

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const metaRows = meta
    ? Object.entries(meta).map(([k, v]) =>
        `<tr><td style="padding:3px 8px;color:#64748B;font-size:12px;">${k}</td><td style="padding:3px 8px;font-size:12px;font-family:monospace;">${String(v ?? '—')}</td></tr>`
      ).join('')
    : '';

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: env.DEV_EMAIL,
      subject: `[Replate Warning] ${message.slice(0, 80)}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#0F172A;">
          <div style="border:1px solid #FCD34D;border-radius:14px;padding:20px;background:#FFFBEB;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#D97706;margin:0 0 6px;">Replate Nutrition — Warning</p>
            <h3 style="margin:0 0 8px;">${message}</h3>
            <p style="color:#64748B;font-size:13px;margin:0 0 12px;">${now} · ${getActiveUserCount()} active users</p>
            ${metaRows ? `<table style="width:100%;border-collapse:collapse;"><tbody>${metaRows}</tbody></table>` : ''}
          </div>
        </div>`,
    });
  } catch { /* never break the app */ }
}

// ---------------------------------------------------------------------------
// User-submitted Issue Reports
// ---------------------------------------------------------------------------

export interface UserIssueReport {
  userId?: string;
  userEmail?: string;
  userName?: string;
  description: string;
  route?: string;
  workflow?: string;      // e.g. "shopping-session", "meal-plan", "support-form"
  screenshot?: string;   // optional base64 or URL
  metadata?: Record<string, unknown>;
}

/** Send a user-submitted issue report to the dev email. */
export async function reportUserIssue(report: UserIssueReport): Promise<void> {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const activeCount = getActiveUserCount();

  // Always log
  console.log('[USER REPORT]', report);

  if (!resend || !env.DEV_EMAIL) return;

  const metaRows = report.metadata
    ? Object.entries(report.metadata).map(([k, v]) =>
        `<tr><td style="padding:3px 8px;color:#64748B;font-size:12px;">${k}</td><td style="padding:3px 8px;font-size:12px;font-family:monospace;">${String(v ?? '—')}</td></tr>`
      ).join('')
    : '';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#0F172A;">
      <div style="border:1px solid #A5B4FC;border-radius:16px;padding:24px;background:#F5F3FF;">
        <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6D28D9;margin:0 0 8px;">Replate Nutrition — User Report</p>
        <h2 style="font-size:18px;margin:0 0 6px;">Issue from ${report.userName || 'Unknown User'}</h2>
        <p style="color:#64748B;font-size:13px;margin:0 0 16px;">${now} · ${activeCount} active user${activeCount !== 1 ? 's' : ''} online</p>

        <div style="background:#EDE9FE;border:1px solid #C4B5FD;border-radius:10px;padding:14px;margin-bottom:16px;">
          <p style="font-size:13px;font-weight:600;margin:0 0 6px;color:#4C1D95;">User Description</p>
          <p style="font-size:14px;margin:0;white-space:pre-wrap;">${report.description}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tbody>
            <tr><td style="padding:4px 8px;color:#64748B;font-size:12px;">Email</td><td style="padding:4px 8px;font-size:13px;">${report.userEmail || '—'}</td></tr>
            <tr><td style="padding:4px 8px;color:#64748B;font-size:12px;">Route</td><td style="padding:4px 8px;font-size:13px;font-family:monospace;">${report.route || '—'}</td></tr>
            <tr><td style="padding:4px 8px;color:#64748B;font-size:12px;">Workflow</td><td style="padding:4px 8px;font-size:13px;">${report.workflow || '—'}</td></tr>
            ${metaRows}
          </tbody>
        </table>

        <a href="${env.FRONTEND_URL}" style="display:inline-block;padding:10px 16px;background:#1E293B;color:white;border-radius:10px;text-decoration:none;font-size:13px;">Open App</a>
      </div>
    </div>`;

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: env.DEV_EMAIL,
      subject: `[Replate Feedback] ${report.workflow || 'User'}: ${report.description.slice(0, 60)}`,
      html,
    });
  } catch { /* never break the app */ }
}
