import { AccountSuspension } from '../models/AccountSuspension';
import { UserPresence } from '../models/UserPresence';

// ---- Suspension ------------------------------------------------------------------------------

// Asked on every authenticated request, so the answer is remembered for a short while. Suspending
// or restoring an account clears its entry straight away (forgetSuspension), so on this server the
// change is immediate; a second server instance would catch up within this window.
const SUSPENSION_CACHE_MS = 60_000;
const MAX_CACHED_ACCOUNTS = 50_000;
const suspensionCache = new Map<string, { suspended: boolean; at: number }>();

export async function isSuspended(firebaseUid: string): Promise<boolean> {
  const cached = suspensionCache.get(firebaseUid);
  if (cached && Date.now() - cached.at < SUSPENSION_CACHE_MS) return cached.suspended;
  // A lookup failure must not lock everyone out: fall back to the last known answer, else "not
  // suspended". The Firebase-side disable still stops new sign-ins.
  try {
    const suspended = !!(await AccountSuspension.exists({ firebaseUid }));
    if (suspensionCache.size >= MAX_CACHED_ACCOUNTS) suspensionCache.clear();
    suspensionCache.set(firebaseUid, { suspended, at: Date.now() });
    return suspended;
  } catch (err) {
    console.error('[accountStatus] suspension lookup failed', err);
    return cached?.suspended ?? false;
  }
}

export function forgetSuspension(firebaseUid: string): void {
  suspensionCache.delete(firebaseUid);
}

// ---- Presence --------------------------------------------------------------------------------

// Writing on every request would be a database write per tap; once a minute per account is plenty
// for "active in the last five minutes".
const PRESENCE_THROTTLE_MS = 60_000;
const lastTouched = new Map<string, number>();

export function touchPresence(firebaseUid: string): void {
  const now = Date.now();
  const last = lastTouched.get(firebaseUid) ?? 0;
  if (now - last < PRESENCE_THROTTLE_MS) return;
  if (lastTouched.size >= MAX_CACHED_ACCOUNTS) lastTouched.clear();
  lastTouched.set(firebaseUid, now);
  // Never delays or fails the request it is attached to.
  UserPresence.updateOne({ firebaseUid }, { $set: { lastActiveAt: new Date(now) } }, { upsert: true }).catch((err) => {
    console.error('[accountStatus] could not record activity', err);
  });
}

// For tests.
export function resetAccountStatusCaches(): void {
  suspensionCache.clear();
  lastTouched.clear();
}
