import { Response } from 'express';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { sendEmail } from '../utils/email';
import { firebaseAuth } from '../config/firebaseAdmin';
import { buildWelcomeEmailHtml, buildLoginNotifyEmailHtml, buildPasswordResetEmailHtml } from '../services/authEmailHtml';

export async function sendWelcomeEmail(req: AuthedRequest, res: Response) {
  if (!req.userEmail) throw new ApiError(400, 'This account has no email address on file.', 'general');
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : undefined;
  const { subject, html, text } = buildWelcomeEmailHtml(fullName);
  await sendEmail({ to: req.userEmail, subject, html, text });
  res.status(204).end();
}

export async function sendLoginNotifyEmail(req: AuthedRequest, res: Response) {
  if (!req.userEmail) throw new ApiError(400, 'This account has no email address on file.', 'general');
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : undefined;
  const { subject, html, text } = buildLoginNotifyEmailHtml(fullName);
  await sendEmail({ to: req.userEmail, subject, html, text });
  res.status(204).end();
}

// Unauthenticated — the whole point is for a logged-out user who forgot their
// password. generatePasswordResetLink (Admin SDK) produces the same kind of
// Firebase-hosted reset link sendPasswordResetEmail would have, just without
// Firebase also sending its own competing email — this is the only thing that
// actually emails it now.
// NOTE: unlike the client SDK, the Admin SDK's generatePasswordResetLink
// always throws auth/user-not-found for a nonexistent email, regardless of
// this Firebase project's Email Enumeration Protection setting (a
// console-level setting, not something this code can see) — so this endpoint
// may reveal account existence more explicitly than the old client-side flow
// did. If that's not acceptable, catch auth/user-not-found below and return
// the same generic success response either way instead.
export async function forgotPassword(req: AuthedRequest, res: Response) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email) throw new ApiError(400, 'Email is required.', 'email');

  let resetLink: string;
  try {
    resetLink = await firebaseAuth.generatePasswordResetLink(email);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/user-not-found') {
      throw new ApiError(404, 'There is no account with this email address.', 'email');
    }
    if (code === 'auth/invalid-email') {
      throw new ApiError(400, 'That email address looks invalid.', 'email');
    }
    throw err;
  }

  const { subject, html, text } = buildPasswordResetEmailHtml(resetLink);
  await sendEmail({ to: email, subject, html, text });
  res.json({ message: 'Reset link sent.' });
}
