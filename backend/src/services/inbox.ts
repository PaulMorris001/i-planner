import { isValidObjectId } from 'mongoose';
import { InboxNotification } from '../models/InboxNotification';
import { ApiError } from '../utils/ApiError';

export const INBOX_PAGE_SIZE = 50;

export interface InboxContent {
  title: string;
  body: string;
  route?: string;
}

// Adds one message to each person's inbox. Never throws: the inbox is a convenience, and a problem
// here must not stop the push, email or request that triggered it.
export async function recordInbox(firebaseUids: string[], kind: string, content: InboxContent): Promise<void> {
  const uids = [...new Set(firebaseUids)].filter(Boolean);
  if (!uids.length) return;
  try {
    await InboxNotification.insertMany(
      uids.map((firebaseUid) => ({
        firebaseUid,
        kind,
        title: content.title.slice(0, 120),
        body: content.body.slice(0, 700),
        route: content.route,
      })),
      { ordered: false }
    );
  } catch (err) {
    console.error('[inbox] could not record a notification', err);
  }
}

export async function listInbox(firebaseUid: string) {
  const [rows, unreadCount] = await Promise.all([
    InboxNotification.find({ firebaseUid }).sort({ createdAt: -1 }).limit(INBOX_PAGE_SIZE).lean(),
    InboxNotification.countDocuments({ firebaseUid, readAt: { $exists: false } }),
  ]);
  return {
    unreadCount,
    items: rows.map((n) => ({
      id: String(n._id),
      kind: n.kind,
      title: n.title,
      body: n.body,
      route: n.route ?? null,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markRead(firebaseUid: string, id: string): Promise<void> {
  if (!isValidObjectId(id)) throw new ApiError(404, 'Notification not found.', 'general');
  await InboxNotification.updateOne({ _id: id, firebaseUid, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
}

export async function markAllRead(firebaseUid: string): Promise<void> {
  await InboxNotification.updateMany({ firebaseUid, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
}
