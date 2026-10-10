import type { Schema } from 'mongoose';
import { sendSilentToTokens, tokensForUser } from './pushNotifications';

// Reminders live on each phone, scheduled from the data it last downloaded. When something
// changes from one device (or from the AI Coach, a calendar import, ...), the user's OTHER
// devices have no way to know until they next open the app. This sends them a silent push that
// wakes the app so it refreshes and schedules its own reminders.

// A burst of changes (a syllabus creating twenty tasks) becomes one wake-up.
const DEBOUNCE_MS = 3000;
const pendingByUser = new Map<string, ReturnType<typeof setTimeout>>();

export function requestDeviceSync(firebaseUid: string | undefined | null): void {
  if (!firebaseUid || pendingByUser.has(firebaseUid)) return;
  const timer = setTimeout(async () => {
    pendingByUser.delete(firebaseUid);
    try {
      const tokens = await tokensForUser(firebaseUid);
      // One device: it already knows what it just did.
      if (tokens.length < 2) return;
      await sendSilentToTokens(tokens, { kind: 'sync' });
    } catch (err) {
      console.error('[deviceSync] could not wake the other devices', err);
    }
  }, DEBOUNCE_MS);
  // Never keeps a shutting-down server alive.
  (timer as { unref?: () => void }).unref?.();
  pendingByUser.set(firebaseUid, timer);
}

type MaybeOwned = { firebaseUid?: string } | null | undefined;

// Mongoose plugin: any write to this collection, from any code path, asks the owner's devices to
// refresh. Hooked on the model so no controller or service can forget to do it.
export function syncDevicesOnChange(schema: Schema): void {
  const ownerOf = (doc: MaybeOwned) => requestDeviceSync(doc?.firebaseUid);
  const ownerOfFilter = (query: { getFilter?: () => Record<string, unknown> }) => {
    const uid = query.getFilter?.().firebaseUid;
    if (typeof uid === 'string') requestDeviceSync(uid);
  };

  schema.post('save', function (doc: MaybeOwned) {
    ownerOf(doc);
  });
  schema.post('insertMany', function (docs: MaybeOwned[]) {
    new Set(docs.map((d) => d?.firebaseUid)).forEach((uid) => requestDeviceSync(uid));
  });
  schema.post(['findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete'] as never, function (doc: MaybeOwned) {
    ownerOf(doc);
  });
  schema.post(['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'] as never, function (this: { getFilter?: () => Record<string, unknown> }) {
    ownerOfFilter(this);
  });
  schema.post('deleteOne' as never, { document: true, query: false } as never, function (this: MaybeOwned) {
    ownerOf(this);
  });
}
