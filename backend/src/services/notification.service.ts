import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type Recipient = {
  email: string;
  fullName: string;
};

type MealReminderItem = {
  mealName: string;
  mealType: string;
  profile?: {
    name: string;
    type: string;
  } | null;
};

type ShoppingAlertItem = {
  itemName: string;
  quantity?: string | null;
  category?: string | null;
};

function ensureEmailProvider() {
  if (!resend) {
    throw new Error('Email notifications are not configured. Set RESEND_API_KEY and FROM_EMAIL to enable them.');
  }
}

function renderLayout(title: string, intro: string, body: string, footer: string) {
  return `
    <div style="background-color:#ffffff;font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#0F172A;">
      <div style="border:1px solid #E2E8F0;border-radius:20px;padding:28px;background-color:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;margin:0 0 10px;">Replate Nutrition</p>
        <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#0F172A;">${title}</h1>
        <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px;">${intro}</p>
        ${body}
      </div>
      <p style="font-size:12px;line-height:1.6;color:#64748B;margin:16px 6px 0;">${footer}</p>
    </div>
  `;
}

export function emailNotificationsConfigured() {
  return Boolean(resend);
}

export async function sendTestNotificationEmail(recipient: Recipient) {
  ensureEmailProvider();

  const { error } = await resend!.emails.send({
    from: env.FROM_EMAIL,
    to: recipient.email,
    subject: 'Your Replate Nutrition email notifications are enabled',
    html: renderLayout(
      'Email notifications are on',
      `Hi ${recipient.fullName.split(' ')[0] || recipient.fullName}, this is a test email confirming that Replate Nutrition can send notification emails to this address.`,
      `
        <div style="padding: 16px 18px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 14px; margin-bottom: 18px;">
          <p style="font-size: 14px; line-height: 1.6; color: #1E3A8A; margin: 0;">You will only receive emails for notification categories you enable in Settings, and you can turn them off at any time.</p>
        </div>
        <a href="${env.FRONTEND_URL}/settings" style="display: inline-block; padding: 12px 18px; background: #2563EB; color: white; border-radius: 12px; text-decoration: none; font-weight: 600;">Manage notification settings</a>
      `,
      'These emails are informational and are not medical, nutritional, or veterinary advice.'
    ),
  });

  if (error) {
    throw new Error(`Failed to send test email: ${error.message}`);
  }
}

export async function sendMealReminderEmail(recipient: Recipient, meals: MealReminderItem[]) {
  ensureEmailProvider();

  const listMarkup = meals.map((meal) => `
    <li style="margin-bottom: 12px;">
      <strong style="color: #0F172A;">${meal.mealType.replace(/_/g, ' ')}</strong>
      <span style="color: #475569;">: ${meal.mealName}</span>
      ${meal.profile ? `<div style="font-size: 13px; color: #64748B; margin-top: 3px;">For ${meal.profile.name}${meal.profile.type === 'PET' ? ' (pet profile)' : ''}</div>` : ''}
    </li>
  `).join('');

  const { error } = await resend!.emails.send({
    from: env.FROM_EMAIL,
    to: recipient.email,
    subject: 'Your meal plan for today',
    html: renderLayout(
      'Today\'s meal reminder',
      `Hi ${recipient.fullName.split(' ')[0] || recipient.fullName}, here is your meal plan summary for today.`,
      `
        <ul style="padding-left: 18px; margin: 0 0 20px; color: #334155; line-height: 1.6;">
          ${listMarkup}
        </ul>
        <a href="${env.FRONTEND_URL}/meal-plan" style="display: inline-block; padding: 12px 18px; background: #0F766E; color: white; border-radius: 12px; text-decoration: none; font-weight: 600;">Open meal plan</a>
      `,
      'You can disable meal reminder emails at any time in Settings.'
    ),
  });

  if (error) {
    throw new Error(`Failed to send meal reminder email: ${error.message}`);
  }
}

export async function sendShoppingAlertEmail(recipient: Recipient, items: ShoppingAlertItem[], sourceLabel: string) {
  ensureEmailProvider();

  const previewItems = items.slice(0, 8);
  const listMarkup = previewItems.map((item) => `
    <li style="margin-bottom: 10px;">
      <strong style="color: #0F172A;">${item.itemName}</strong>
      ${item.quantity ? `<span style="color: #475569;"> · ${item.quantity}</span>` : ''}
      ${item.category ? `<div style="font-size: 13px; color: #64748B; margin-top: 2px;">${item.category}</div>` : ''}
    </li>
  `).join('');

  const remainder = items.length > previewItems.length
    ? `<p style="font-size: 13px; color: #64748B; margin: 16px 0 0;">Plus ${items.length - previewItems.length} more item(s).</p>`
    : '';

  const { error } = await resend!.emails.send({
    from: env.FROM_EMAIL,
    to: recipient.email,
    subject: 'Your shopping list was updated',
    html: renderLayout(
      'Shopping list update',
      `Hi ${recipient.fullName.split(' ')[0] || recipient.fullName}, ${sourceLabel}.`,
      `
        <ul style="padding-left: 18px; margin: 0 0 20px; color: #334155; line-height: 1.6;">
          ${listMarkup}
        </ul>
        ${remainder}
        <a href="${env.FRONTEND_URL}/shopping" style="display: inline-block; padding: 12px 18px; background: #7C3AED; color: white; border-radius: 12px; text-decoration: none; font-weight: 600;">Open shopping list</a>
      `,
      'You can disable shopping alert emails at any time in Settings.'
    ),
  });

  if (error) {
    throw new Error(`Failed to send shopping alert email: ${error.message}`);
  }
}

type PriceDropItem = {
  itemName: string;
  storeName: string;
  oldPrice: number;
  newPrice: number;
};

export async function sendPriceDropEmail(recipient: Recipient, drops: PriceDropItem[]) {
  ensureEmailProvider();

  const listMarkup = drops.map((d) => {
    const pct = Math.round(((d.oldPrice - d.newPrice) / d.oldPrice) * 100);
    return `
      <li style="margin-bottom: 12px;">
        <strong style="color: #0F172A;">${d.itemName}</strong>
        <span style="color: #475569;"> at ${d.storeName}</span>
        <div style="font-size: 13px; margin-top: 3px;">
          <span style="text-decoration: line-through; color: #94A3B8;">$${d.oldPrice.toFixed(2)}</span>
          <span style="color: #059669; font-weight: 600; margin-left: 6px;">$${d.newPrice.toFixed(2)}</span>
          <span style="color: #059669; font-size: 12px; margin-left: 4px;">(-${pct}%)</span>
        </div>
      </li>
    `;
  }).join('');

  const { error } = await resend!.emails.send({
    from: env.FROM_EMAIL,
    to: recipient.email,
    subject: `Price drop alert: ${drops.length} item${drops.length > 1 ? 's' : ''} dropped in price`,
    html: renderLayout(
      'Price drop alert',
      `Hi ${recipient.fullName.split(' ')[0] || recipient.fullName}, prices have dropped on items you&rsquo;ve shopped for recently.`,
      `
        <ul style="padding-left: 18px; margin: 0 0 20px; color: #334155; line-height: 1.6; list-style: none;">
          ${listMarkup}
        </ul>
        <a href="${env.FRONTEND_URL}/shopping" style="display: inline-block; padding: 12px 18px; background: #059669; color: white; border-radius: 12px; text-decoration: none; font-weight: 600;">View shopping list</a>
      `,
      'You can disable price drop alerts at any time in Settings.'
    ),
  });

  if (error) {
    throw new Error(`Failed to send price drop email: ${error.message}`);
  }
}