import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PushToken } from '../models/PushToken';
import { Settings } from '../models/Settings';

// Sending via Expo's push service, which relays to FCM (Android) and APNs (iOS)
// using the credentials stored in EAS — the backend only ever sees Expo push
// tokens, never raw FCM/APNs ones.
const expo = new Expo();

// Android channels the app creates (utils/notifications.ts) — every push is
// filed under one, and an unknown id is dropped or demoted. Announcements get
// their own (mutable separately); reminder-style pushes reuse the reminders one.
const ANNOUNCEMENT_CHANNEL_ID = 'announcements';
export const REMINDERS_CHANNEL_ID = 'planner-reminders';

// The app reads `kind` to decide how to show and route a push: 'announcement'
// and 'task-nudge' always show; 'ai-reply' is hidden while the app is open.
export type PushKind = 'announcement' | 'task-nudge' | 'ai-reply';

export interface PushContent {
  title: string;
  body: string;
  // In-app route to open when tapped, e.g. "/notes" (see the app's
  // registerPushNotificationRouting). Optional.
  route?: string;
}

export interface PushSendResult {
  targeted: number;
  accepted: number;
  failed: number;
  removedTokens: number;
  // Expo ticket ids for accepted messages -- pass to checkPushReceipts.
  ticketIds: string[];
}

// Delivers one message to every given token. Tokens Expo rejects outright as
// unregistered (app uninstalled, notifications revoked) are deleted, so later
// sends don't keep paying for them.
export async function sendPushToTokens(
  tokens: string[],
  content: PushContent,
  options: { kind?: PushKind; channelId?: string } = {}
): Promise<PushSendResult> {
  const kind = options.kind ?? 'announcement';
  const channelId = options.channelId ?? ANNOUNCEMENT_CHANNEL_ID;
  const valid = [...new Set(tokens)].filter((t) => Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    title: content.title,
    body: content.body,
    sound: 'default',
    channelId,
    data: { kind, ...(content.route ? { route: content.route } : {}) },
  }));

  const tickets: { token: string; ticket: ExpoPushTicket }[] = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      chunkTickets.forEach((ticket, i) => tickets.push({ token: chunk[i].to as string, ticket }));
    } catch (err) {
      console.error('[push] chunk send failed', err);
      chunk.forEach((m) => tickets.push({ token: m.to as string, ticket: { status: 'error', message: 'send failed' } }));
    }
  }

  const dead = tickets
    .filter(({ ticket }) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered')
    .map(({ token }) => token);
  if (dead.length) await PushToken.deleteMany({ token: { $in: dead } });

  const accepted = tickets.filter(({ ticket }) => ticket.status === 'ok').length;
  const ticketIds = tickets.flatMap(({ ticket }) => (ticket.status === 'ok' ? [ticket.id] : []));
  return { targeted: valid.length, accepted, failed: tickets.length - accepted, removedTokens: dead.length, ticketIds };
}

export interface PushReceiptSummary {
  delivered: number;
  pending: number;
  errors: { error?: string; message: string }[];
}

// "Accepted" only means Expo took the message. Whether Apple/Google actually
// delivered it shows up a few seconds later as a receipt -- this is where
// credential problems (e.g. InvalidCredentials) and dead devices surface.
export async function checkPushReceipts(ticketIds: string[]): Promise<PushReceiptSummary> {
  const summary: PushReceiptSummary = { delivered: 0, pending: 0, errors: [] };
  for (const chunk of expo.chunkPushNotificationReceiptIds(ticketIds)) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    for (const id of chunk) {
      const receipt = receipts[id];
      if (!receipt) summary.pending++;
      else if (receipt.status === 'ok') summary.delivered++;
      else summary.errors.push({ error: receipt.details?.error, message: receipt.message });
    }
  }
  return summary;
}

// Announcements go only to users who switched on "Product updates" in the app
// (Settings.productUpdatesEnabled) — App Store guideline 4.5.4 requires explicit
// opt-in for promotional pushes, and an in-app way to opt out.
export async function announcementTokens(onlyFirebaseUids?: string[]): Promise<string[]> {
  const optedIn = await Settings.find(
    { productUpdatesEnabled: true, ...(onlyFirebaseUids ? { firebaseUid: { $in: onlyFirebaseUids } } : {}) },
    'firebaseUid'
  );
  const uids = optedIn.map((s) => s.firebaseUid);
  if (!uids.length) return [];
  const rows = await PushToken.find({ firebaseUid: { $in: uids } }, 'token');
  return rows.map((r) => r.token);
}

// Every registered device for one account (it may be signed in on several).
export async function tokensForUser(firebaseUid: string): Promise<string[]> {
  const rows = await PushToken.find({ firebaseUid }, 'token');
  return rows.map((r) => r.token);
}

// Best-effort push to one account: logs instead of throwing, so a push
// problem can never break the request or job that triggered it.
export async function sendPushToUser(
  firebaseUid: string,
  content: PushContent,
  options: { kind: PushKind; channelId?: string }
): Promise<void> {
  try {
    const tokens = await tokensForUser(firebaseUid);
    if (tokens.length) await sendPushToTokens(tokens, content, options);
  } catch (err) {
    console.error(`[push] ${options.kind} push failed`, err);
  }
}
