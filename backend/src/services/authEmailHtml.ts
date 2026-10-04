import { env } from '../config/env';
import { AI_QUERY_CAPS } from '../constants/aiUsage';
import type { SubscriptionTier } from '../models/Subscription';

// App icon, served from backend/public/email-logo.png (192px, so it stays sharp
// at 56px on high-density screens). Must be an absolute https URL -- inboxes
// fetch images themselves, there's no relative path in an email.
const LOGO_URL = `${env.backendPublicUrl}/email-logo.png`;

// Escaping matters here even though fullName/email come from Firebase (not
// arbitrary freeform text like a note body) — a display name is still
// user-chosen text that ends up interpolated into HTML an email client
// renders, so treat it the same as sharedNoteHtml.ts treats note content.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Mostly inline styles, not a <style> block — unlike sharedNoteHtml.ts's web
// page (rendered by a real browser), this HTML runs through inboxes like
// Outlook desktop that strip or mangle <style> blocks, so anything that
// actually matters for legibility is inlined per-element instead.
function page(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:32px 20px;background:#F7F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F0E2A;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E3EF;border-radius:20px;padding:28px;">
      <img src="${LOGO_URL}" width="56" height="56" alt="i-Planner" style="display:block;width:56px;height:56px;border:0;border-radius:14px;margin:0 0 20px;" />
      ${bodyHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E4E3EF;font-size:12px;color:#A8A7BE;">
        i-Planner
      </div>
    </div>
  </body>
</html>`;
}

function greeting(fullName: string | undefined): string {
  return fullName?.trim() ? escapeHtml(fullName.trim()) : 'there';
}

export function buildWelcomeEmailHtml(fullName: string | undefined): { subject: string; html: string; text: string } {
  const name = greeting(fullName);
  const subject = 'Welcome to i-Planner';
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 12px;">Welcome, ${name}!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Your i-Planner account is ready. Glad to have you here.</p>
    <p style="font-size:15px;line-height:1.6;margin:0;">Jump back into the app to start planning your tasks, habits, and goals.</p>`
  );
  const text = `Welcome, ${name}!\n\nYour i-Planner account is ready. Glad to have you here.`;
  return { subject, html, text };
}

// Sent only for a sign-in from a device not seen before on this account.
export function buildLoginNotifyEmailHtml(
  fullName: string | undefined,
  deviceLabel: string | undefined,
  when: Date
): { subject: string; html: string; text: string } {
  const name = greeting(fullName);
  const device = deviceLabel ? escapeHtml(deviceLabel) : 'a new device';
  // UTC, spelled out -- the server doesn't know the reader's time zone.
  const time = when.toUTCString().replace('GMT', 'UTC');
  const subject = 'New sign-in to your i-Planner account';
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 12px;">New sign-in detected</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Hi ${name}, your i-Planner account was just signed in to from a device we haven't seen before:</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;padding:12px 14px;background:#F7F7FB;border-radius:12px;"><strong>${device}</strong><br/><span style="color:#6B6A80;font-size:13px;">${time}</span></p>
    <p style="font-size:15px;line-height:1.6;margin:0;">If this was you, there's nothing to do. If it wasn't, reset your password from the i-Planner sign-in screen ("Forgot password") right away.</p>`
  );
  const text = `Hi ${name}, your i-Planner account was just signed in to from a device we haven't seen before:\n\n${deviceLabel ?? 'A new device'}\n${time}\n\nIf this was you, there's nothing to do. If it wasn't, reset your password from the i-Planner sign-in screen ("Forgot password") right away.`;
  return { subject, html, text };
}

export function buildPasswordResetEmailHtml(resetLink: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your i-Planner password';
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">We received a request to reset your i-Planner password. Tap the button below to choose a new one. If you didn't request this, you can safely ignore this email.</p>
    <a href="${escapeHtml(resetLink)}" style="display:block;text-align:center;background:#3B82F6;color:#fff;font-weight:700;text-decoration:none;padding:14px;border-radius:999px;font-size:15px;">Reset password</a>`
  );
  const text = `We received a request to reset your i-Planner password.\n\nReset it here: ${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`;
  return { subject, html, text };
}

type PaidTier = Exclude<SubscriptionTier, 'free'>;

const TIER_NAME: Record<PaidTier, string> = {
  student: 'Student / Edu',
  professional: 'Professional',
  premium: 'Premium AI',
};

// What each paid tier unlocks -- kept to features the backend actually gates
// (constants/featureTiers.ts) plus the AI limits, so the email never promises
// something the plan doesn't include.
function tierBenefits(tier: PaidTier): string[] {
  const aiActions = `${AI_QUERY_CAPS[tier].toLocaleString('en-US')} AI actions every month`;
  if (tier === 'student') {
    return [aiActions, 'AI syllabus & timetable scanning', 'AI Study Buddy for any subject', 'Classes, deadlines & exam countdowns'];
  }
  if (tier === 'professional') {
    return ['Everything in Student / Edu', aiActions, 'AI Plan My Day & AI Goal Coach', 'AI certification & exam study plans'];
  }
  return ['Everything in Professional', aiActions, 'Every AI coach: study, planning & goals', 'The most AI for high-stakes goals'];
}

export interface UpgradeEmailInput {
  fullName?: string;
  tier: PaidTier;
  billing: 'Monthly' | 'Annual' | undefined;
  renewsAt?: Date;
  store: 'app_store' | 'play_store';
}

// Sent once when a verified purchase starts or changes a subscription (see
// subscription.controller.ts). A confirmation and welcome, not the official
// receipt -- Apple/Google send that themselves, with the amount charged.
export function buildUpgradeEmailHtml(input: UpgradeEmailInput): { subject: string; html: string; text: string } {
  const name = greeting(input.fullName);
  const plan = TIER_NAME[input.tier];
  const storeName = input.store === 'app_store' ? 'the App Store' : 'Google Play';
  const renews = input.renewsAt
    ? input.renewsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : undefined;
  const benefits = tierBenefits(input.tier);
  const subject = `You're on i-Planner ${plan}: payment confirmed`;

  const rows: [string, string][] = [
    ['Plan', input.billing ? `${plan} (${input.billing})` : plan],
    ...(renews ? ([['Renews on', renews]] as [string, string][]) : []),
    ['Paid through', storeName === 'the App Store' ? 'App Store' : 'Google Play'],
  ];
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 12px;">Welcome to ${escapeHtml(plan)}!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Thanks, ${name}. Your payment went through and your new plan is active right now. Enjoy everything it unlocks.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F7F7FB;border-radius:12px;margin:0 0 20px;border-collapse:separate;">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 14px;font-size:13px;color:#6B6A80;">${label}</td><td style="padding:10px 14px;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td></tr>`
        )
        .join('')}
    </table>
    <p style="font-size:15px;font-weight:700;margin:0 0 8px;">What you've unlocked</p>
    <ul style="font-size:15px;line-height:1.7;margin:0 0 20px;padding-left:20px;">
      ${benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
    </ul>
    <p style="font-size:13px;line-height:1.6;color:#6B6A80;margin:0;">Your official receipt comes from ${storeName}. You can manage or cancel your subscription any time in your ${storeName} account settings.</p>`
  );
  const text = [
    `Welcome to ${plan}!`,
    '',
    `Thanks, ${name}. Your payment went through and your new plan is active right now.`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    "What you've unlocked:",
    ...benefits.map((b) => `- ${b}`),
    '',
    `Your official receipt comes from ${storeName}. Manage or cancel any time in your ${storeName} account settings.`,
  ].join('\n');
  return { subject, html, text };
}
