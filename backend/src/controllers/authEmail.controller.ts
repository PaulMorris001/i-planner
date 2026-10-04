import { Response } from 'express';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { sendEmail } from '../utils/email';
import { firebaseAuth } from '../config/firebaseAdmin';
import { KnownDevice } from '../models/KnownDevice';

interface DeviceInfo {
  deviceId: string;
  label?: string;
}

// The app's per-install device id + display label, sent with sign-up and
// sign-in. Missing (older app versions) or malformed -> null.
function readDevice(body: unknown): DeviceInfo | null {
  const { deviceId, deviceLabel } = (body ?? {}) as { deviceId?: unknown; deviceLabel?: unknown };
  if (typeof deviceId !== 'string' || !/^[\w-]{8,100}$/.test(deviceId)) return null;
  const label = typeof deviceLabel === 'string' && deviceLabel.trim() ? deviceLabel.trim().slice(0, 80) : undefined;
  return { deviceId, label };
}

// Records the device as known. Returns true only if it wasn't known before.
async function rememberDevice(firebaseUid: string, device: DeviceInfo): Promise<boolean> {
  const now = new Date();
  const result = await KnownDevice.updateOne(
    { firebaseUid, deviceId: device.deviceId },
    { $set: { lastSeenAt: now, ...(device.label ? { label: device.label } : {}) }, $setOnInsert: { firstSeenAt: now } },
    { upsert: true }
  );
  return result.upsertedCount === 1;
}
import { buildWelcomeEmailHtml, buildLoginNotifyEmailHtml, buildPasswordResetEmailHtml } from '../services/authEmailHtml';

export async function sendWelcomeEmail(req: AuthedRequest, res: Response) {
  if (!req.userEmail) throw new ApiError(400, 'This account has no email address on file.', 'general');
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : undefined;
  // The device someone signs up on is known from the start, so signing in on
  // it later never triggers a "new device" email.
  const device = readDevice(req.body);
  if (device) await rememberDevice(req.userId!, device);
  const { subject, html, text } = buildWelcomeEmailHtml(fullName);
  await sendEmail({ to: req.userEmail, subject, html, text });
  res.status(204).end();
}

export async function sendLoginNotifyEmail(req: AuthedRequest, res: Response) {
  if (!req.userEmail) throw new ApiError(400, 'This account has no email address on file.', 'general');
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : undefined;
  // Only sign-ins from a device we haven't seen get an email. Older app
  // versions don't send a device id - skip rather than email every sign-in.
  const device = readDevice(req.body);
  if (!device) {
    res.status(204).end();
    return;
  }
  const hadDevices = (await KnownDevice.countDocuments({ firebaseUid: req.userId })) > 0;
  const isNewDevice = await rememberDevice(req.userId!, device);
  // A user's first recorded device is saved silently: existing accounts from
  // before device tracking would otherwise all get a "new device" email on
  // their next sign-in.
  if (isNewDevice && hadDevices) {
    const { subject, html, text } = buildLoginNotifyEmailHtml(fullName, device.label, new Date());
    await sendEmail({ to: req.userEmail, subject, html, text });
  }
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
