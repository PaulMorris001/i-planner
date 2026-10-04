import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PushToken } from '../models/PushToken';
import { Settings } from '../models/Settings';

// Sending via Expo's push service, which relays to FCM (Android) and APNs (iOS)
// using the credentials stored in EAS — the backend only ever sees Expo push
// tokens, never raw FCM/APNs ones.
const expo = new Expo();

// Must match the channel the app creates (utils/notifications.ts) — Android
// files every push under a channel, and an unknown one is dropped or demoted.
const ANNOUNCEMENT_CHANNEL_ID = 'announcements';

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
}

// Delivers one message to every given token. Tokens Expo rejects outright as
// unregistered (app uninstalled, notifications revoked) are deleted, so later
// sends don't keep paying for them.
export async function sendPushToTokens(tokens: string[], content: PushContent): Promise<PushSendResult> {
  const valid = [...new Set(tokens)].filter((t) => Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    title: content.title,
    body: content.body,
    sound: 'default',
    channelId: ANNOUNCEMENT_CHANNEL_ID,
    data: { kind: 'announcement', ...(content.route ? { route: content.route } : {}) },
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
  return { targeted: valid.length, accepted, failed: tickets.length - accepted, removedTokens: dead.length };
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
