import { Resend } from 'resend';
import { env } from '../config/env';

// Built lazily so a backend started before RESEND_API_KEY is configured still
// comes up fine (same lazy-client shape as googlePlayVerify.ts's androidPublisher).
let client: Resend | null = null;

function getClient(): Resend {
  if (client) return client;
  if (!env.resendApiKey) throw new Error('RESEND_API_KEY is not configured.');
  client = new Resend(env.resendApiKey);
  return client;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  // Plain-text fallback for clients that don't render HTML — optional since
  // not every caller needs one.
  text?: string;
}

// Thin wrapper, not a queue/retry system — callers that need resilience
// (e.g. "this must eventually send") should catch and handle that themselves;
// this just throws straight through on any Resend-side failure.
export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<void> {
  if (!env.resendFromEmail) throw new Error('RESEND_FROM_EMAIL is not configured.');
  const { error } = await getClient().emails.send({
    from: env.resendFromEmail,
    to,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
