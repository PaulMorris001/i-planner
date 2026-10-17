import { AccountSuspension } from '../models/AccountSuspension';
import { Announcement } from '../models/Announcement';
import { PushToken } from '../models/PushToken';
import { Settings } from '../models/Settings';
import { ApiError } from '../utils/ApiError';
import { EMAIL_BATCH_SIZE, sendEmailBatch, type BatchEmailMessage } from '../utils/email';
import { escapeHtml, page } from './authEmailHtml';
import { flattenText } from './collabEmailHtml';
import { sendPushToTokens } from './pushNotifications';
import { getDirectory } from './adminUsers';
import { recordInbox } from './inbox';

export const TITLE_MAX = 65;
export const BODY_MAX = 500;
// Resend allows only a couple of requests a second; a batch call is up to 100 messages.
const BATCH_PAUSE_MS = 700;
// In-app screens an announcement can open when tapped.
const ROUTE_PATTERN = /^\/[a-z0-9\-_/]{0,60}$/i;

// 'all' = everyone opted in. 'no_push' = opted in but with no device that can get a push (so only
// email can reach them, e.g. to ask them to switch notifications on).
export type AnnouncementSegment = 'all' | 'no_push';

export interface AnnouncementInput {
  segment: AnnouncementSegment;
  title: string;
  body: string;
  // An in-app path to open on tap, e.g. /notes. Optional.
  route?: string;
  push: boolean;
  email: boolean;
  // Sends only to the admin who is sending it, ignoring the "Product updates" opt-in, so a message
  // can be checked on a real phone and inbox first.
  test: boolean;
}

export interface Audience {
  pushTokens: string[];
  emails: string[];
  // Everyone this announcement is for; each gets it in their in-app notification inbox.
  uids: string[];
}

// Who may receive an announcement: accounts that switched "Product updates" on in the app (App
// Store guideline 4.5.4 requires that opt-in for promotional pushes; the same switch covers
// email), minus suspended or deleted accounts.
export async function resolveAudience(segment: AnnouncementSegment = 'all'): Promise<Audience> {
  const [optedIn, suspended, directory] = await Promise.all([
    Settings.find({ productUpdatesEnabled: true }, { firebaseUid: 1 }).lean(),
    AccountSuspension.find({}, { firebaseUid: 1 }).lean(),
    getDirectory(),
  ]);
  const blocked = new Set(suspended.map((s) => s.firebaseUid));
  const byUid = new Map(directory.map((u) => [u.uid, u]));
  const eligible = optedIn.map((s) => s.firebaseUid).filter((uid) => {
    const user = byUid.get(uid);
    return !!user && !user.disabled && !blocked.has(uid);
  });
  const tokens = await PushToken.find({ firebaseUid: { $in: eligible } }, { token: 1, firebaseUid: 1 }).lean();
  const withDevice = new Set(tokens.map((t) => t.firebaseUid));
  const recipients = segment === 'no_push' ? eligible.filter((uid) => !withDevice.has(uid)) : eligible;
  const emails = recipients.map((uid) => byUid.get(uid)!.email).filter(Boolean);
  return { pushTokens: segment === 'no_push' ? [] : [...new Set(tokens.map((t) => t.token))], emails: [...new Set(emails)], uids: recipients };
}

async function audienceForAdmin(adminUid: string): Promise<Audience> {
  const [tokens, directory] = await Promise.all([PushToken.find({ firebaseUid: adminUid }, { token: 1 }).lean(), getDirectory()]);
  const me = directory.find((u) => u.uid === adminUid);
  return { pushTokens: tokens.map((t) => t.token), emails: me?.email ? [me.email] : [], uids: [adminUid] };
}

export function validateAnnouncement(input: Partial<AnnouncementInput>): AnnouncementInput {
  const title = flattenText(typeof input.title === 'string' ? input.title : '', TITLE_MAX);
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n').trim() : '';
  if (!title) throw new ApiError(400, 'Give the announcement a title.', 'title');
  if (!body) throw new ApiError(400, 'Write the announcement message.', 'body');
  if (body.length > BODY_MAX) throw new ApiError(400, `The message can be up to ${BODY_MAX} characters.`, 'body');
  if (!input.push && !input.email) throw new ApiError(400, 'Choose push, email or both.', 'channels');
  const segment: AnnouncementSegment = input.segment === 'no_push' ? 'no_push' : 'all';
  if (segment === 'no_push' && input.push) throw new ApiError(400, 'People with no push device can only be reached by email.', 'channels');
  let route: string | undefined;
  if (typeof input.route === 'string' && input.route.trim()) {
    route = input.route.trim().startsWith('/') ? input.route.trim() : `/${input.route.trim()}`;
    if (!ROUTE_PATTERN.test(route)) throw new ApiError(400, 'That screen path is not valid.', 'route');
  }
  return { title, body, route, segment, push: !!input.push, email: !!input.email, test: !!input.test };
}

export function buildAnnouncementEmail(title: string, body: string): { subject: string; html: string; text: string } {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br />');
  const html = page(
    `<h1 style="font-size:22px;margin:0 0 14px;">${escapeHtml(title)}</h1>
    <p style="font-size:15px;line-height:1.65;margin:0;">${safeBody}</p>
    <p style="font-size:12.5px;line-height:1.6;color:#6B6A80;margin:22px 0 0;">You're getting this because "Product updates" is switched on in i-Planner. You can turn it off any time in the app under Profile.</p>`
  );
  const text = `${title}\n\n${body}\n\nYou're getting this because "Product updates" is switched on in i-Planner. Turn it off any time in the app under Profile.`;
  return { subject: title, html, text };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One send at a time per server: a second tap, or two admins at once, cannot double-send.
let sending = false;

export interface SendOutcome {
  id: string;
  pushDevices: number;
  pushAccepted: number;
  emailRecipients: number;
  emailSent: number;
  test: boolean;
}

export async function sendAnnouncement(
  admin: { uid: string; email?: string },
  rawInput: Partial<AnnouncementInput>,
  options: { batchPauseMs?: number } = {}
): Promise<SendOutcome> {
  const input = validateAnnouncement(rawInput);
  if (sending) throw new ApiError(409, 'An announcement is already being sent. Wait for it to finish.', 'general');
  sending = true;
  try {
    const audience = input.test ? await audienceForAdmin(admin.uid) : await resolveAudience(input.segment);

    await recordInbox(audience.uids, 'announcement', { title: input.title, body: input.body, route: input.route });

    let pushDevices = 0;
    let pushAccepted = 0;
    if (input.push && audience.pushTokens.length) {
      pushDevices = audience.pushTokens.length;
      const result = await sendPushToTokens(audience.pushTokens, { title: input.title, body: input.body, route: input.route });
      pushAccepted = result.accepted;
    }

    let emailRecipients = 0;
    let emailSent = 0;
    if (input.email && audience.emails.length) {
      emailRecipients = audience.emails.length;
      const { subject, html, text } = buildAnnouncementEmail(input.title, input.body);
      for (let i = 0; i < audience.emails.length; i += EMAIL_BATCH_SIZE) {
        const chunk = audience.emails.slice(i, i + EMAIL_BATCH_SIZE);
        const messages: BatchEmailMessage[] = chunk.map((to) => ({ to, subject, html, text }));
        try {
          await sendEmailBatch(messages);
          emailSent += chunk.length;
        } catch (err) {
          // One failed batch must not stop the rest; the totals tell the admin what got through.
          console.error('[announcement] an email batch failed', err);
        }
        if (i + EMAIL_BATCH_SIZE < audience.emails.length) await sleep(options.batchPauseMs ?? BATCH_PAUSE_MS);
      }
    }

    const saved = await Announcement.create({
      title: input.title,
      body: input.body,
      route: input.route,
      sentPush: input.push,
      sentEmail: input.email,
      test: input.test,
      pushDevices,
      pushAccepted,
      emailRecipients,
      emailSent,
      sentByUid: admin.uid,
      sentByEmail: admin.email,
    });
    return { id: saved.id as string, pushDevices, pushAccepted, emailRecipients, emailSent, test: input.test };
  } finally {
    sending = false;
  }
}

export async function listAnnouncements(limit = 20) {
  const rows = await Announcement.find().sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).lean();
  return rows.map((a) => ({
    id: String(a._id),
    title: a.title,
    body: a.body,
    route: a.route ?? null,
    channels: { push: a.sentPush, email: a.sentEmail },
    test: a.test,
    pushDevices: a.pushDevices,
    pushAccepted: a.pushAccepted,
    emailRecipients: a.emailRecipients,
    emailSent: a.emailSent,
    sentByEmail: a.sentByEmail ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function previewAudience(): Promise<{ pushDevices: number; emailRecipients: number; noPushRecipients: number }> {
  const [audience, noPush] = await Promise.all([resolveAudience(), resolveAudience('no_push')]);
  return { pushDevices: audience.pushTokens.length, emailRecipients: audience.emails.length, noPushRecipients: noPush.emails.length };
}
