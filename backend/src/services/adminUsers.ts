import { firebaseAuth } from '../config/firebaseAdmin';
import { AccountSuspension } from '../models/AccountSuspension';
import { UserPresence } from '../models/UserPresence';
import { Settings } from '../models/Settings';
import { PushToken } from '../models/PushToken';
import { Subscription, type SubscriptionTier } from '../models/Subscription';
import { ApiError } from '../utils/ApiError';
import { forgetSuspension } from './accountStatus';

// One entry per Firebase account. Firebase is the source of truth for who exists, their name and
// email; everything else (plan, suspension, last activity) is attached from our own database.
export interface DirectoryUser {
  uid: string;
  name: string;
  email: string;
  createdAt: number; // epoch ms
  lastSignInAt: number | null;
  disabled: boolean;
  isAdmin: boolean;
  providers: string[];
}

const DIRECTORY_CACHE_MS = 2 * 60 * 1000;
const PAGE_SIZE = 1000; // Firebase's maximum per request

let cache: { at: number; users: DirectoryUser[] } | null = null;
let inFlight: Promise<DirectoryUser[]> | null = null;

async function loadDirectory(): Promise<DirectoryUser[]> {
  const users: DirectoryUser[] = [];
  let pageToken: string | undefined;
  do {
    const page = await firebaseAuth.listUsers(PAGE_SIZE, pageToken);
    for (const u of page.users) {
      users.push({
        uid: u.uid,
        name: u.displayName ?? '',
        email: u.email ?? '',
        createdAt: Date.parse(u.metadata.creationTime) || 0,
        lastSignInAt: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) || null : null,
        disabled: !!u.disabled,
        isAdmin: u.customClaims?.admin === true,
        providers: u.providerData.map((p) => p.providerId),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

// All accounts, newest first. Cached briefly, and concurrent callers share one load.
export async function getDirectory(forceFresh = false): Promise<DirectoryUser[]> {
  if (!forceFresh && cache && Date.now() - cache.at < DIRECTORY_CACHE_MS) return cache.users;
  if (!inFlight) {
    inFlight = loadDirectory()
      .then((users) => {
        users.sort((a, b) => b.createdAt - a.createdAt);
        cache = { at: Date.now(), users };
        return users;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function invalidateDirectory(): void {
  cache = null;
}

// ---- Listing ----------------------------------------------------------------------------------

// updates_on / updates_off: the "Product updates" opt-in. no_push: no registered device to push to.
export type UserFilter = 'all' | 'suspended' | 'paid' | 'free' | 'admins' | 'updates_on' | 'updates_off' | 'no_push';

export interface AdminUserRow {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  tier: SubscriptionTier;
  suspended: boolean;
  suspendedReason?: string;
  isAdmin: boolean;
  providers: string[];
  // Opted in to announcements (push and email).
  productUpdates: boolean;
  // Devices that can receive a push right now.
  pushDevices: number;
}

export interface UserListQuery {
  search?: string;
  filter?: UserFilter;
  page?: number;
  pageSize?: number;
}

export const MAX_PAGE_SIZE = 50;

function isPaidTier(tier: SubscriptionTier | undefined, expiresAt: Date | undefined): boolean {
  if (!tier || tier === 'free') return false;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

export async function listUsers(query: UserListQuery): Promise<{ users: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(Math.floor(query.pageSize ?? 25), 1), MAX_PAGE_SIZE);
  const page = Math.max(Math.floor(query.page ?? 1), 1);
  const filter = query.filter ?? 'all';
  const needle = (query.search ?? '').trim().toLowerCase();

  let users = await getDirectory();
  if (needle) {
    users = users.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.uid.toLowerCase().includes(needle));
  }

  // Filters that depend on our own collections need those loaded for the whole candidate set.
  let suspensions: Map<string, string | undefined> | null = null;
  let subscriptions: Map<string, { tier: SubscriptionTier; expiresAt?: Date }> | null = null;
  if (filter === 'suspended' || filter === 'paid' || filter === 'free') {
    if (filter === 'suspended') {
      const rows = await AccountSuspension.find({}, { firebaseUid: 1, reason: 1 }).lean();
      suspensions = new Map(rows.map((r) => [r.firebaseUid, r.reason]));
      users = users.filter((u) => suspensions!.has(u.uid));
    } else {
      const rows = await Subscription.find({ tier: { $ne: 'free' } }, { firebaseUid: 1, tier: 1, expiresAt: 1 }).lean();
      subscriptions = new Map(rows.map((r) => [r.firebaseUid, { tier: r.tier, expiresAt: r.expiresAt }]));
      const paidNow = (uid: string) => {
        const s = subscriptions!.get(uid);
        return !!s && isPaidTier(s.tier, s.expiresAt);
      };
      users = users.filter((u) => (filter === 'paid' ? paidNow(u.uid) : !paidNow(u.uid)));
    }
  } else if (filter === 'admins') {
    users = users.filter((u) => u.isAdmin);
  } else if (filter === 'updates_on' || filter === 'updates_off') {
    const rows = await Settings.find({ productUpdatesEnabled: true }, { firebaseUid: 1 }).lean();
    const optedIn = new Set(rows.map((r) => r.firebaseUid));
    users = users.filter((u) => optedIn.has(u.uid) === (filter === 'updates_on'));
  } else if (filter === 'no_push') {
    const rows = await PushToken.distinct('firebaseUid');
    const withDevice = new Set<string>(rows);
    users = users.filter((u) => !withDevice.has(u.uid));
  }

  const total = users.length;
  const slice = users.slice((page - 1) * pageSize, page * pageSize);
  const uids = slice.map((u) => u.uid);

  const [subRows, suspensionRows, presenceRows, settingsRows, tokenRows] = await Promise.all([
    Subscription.find({ firebaseUid: { $in: uids } }, { firebaseUid: 1, tier: 1, expiresAt: 1 }).lean(),
    AccountSuspension.find({ firebaseUid: { $in: uids } }, { firebaseUid: 1, reason: 1 }).lean(),
    UserPresence.find({ firebaseUid: { $in: uids } }, { firebaseUid: 1, lastActiveAt: 1 }).lean(),
    Settings.find({ firebaseUid: { $in: uids }, productUpdatesEnabled: true }, { firebaseUid: 1 }).lean(),
    PushToken.find({ firebaseUid: { $in: uids } }, { firebaseUid: 1 }).lean(),
  ]);
  const optedIn = new Set(settingsRows.map((r) => r.firebaseUid));
  const devicesByUid = new Map<string, number>();
  for (const t of tokenRows) devicesByUid.set(t.firebaseUid, (devicesByUid.get(t.firebaseUid) ?? 0) + 1);
  const subByUid = new Map(subRows.map((r) => [r.firebaseUid, r]));
  const suspendedByUid = new Map(suspensionRows.map((r) => [r.firebaseUid, r.reason]));
  const presenceByUid = new Map(presenceRows.map((r) => [r.firebaseUid, r.lastActiveAt]));

  return {
    total,
    page,
    pageSize,
    users: slice.map((u) => {
      const sub = subByUid.get(u.uid);
      return {
        uid: u.uid,
        name: u.name,
        email: u.email,
        createdAt: new Date(u.createdAt).toISOString(),
        lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
        lastActiveAt: presenceByUid.get(u.uid)?.toISOString() ?? null,
        tier: sub && isPaidTier(sub.tier, sub.expiresAt) ? sub.tier : 'free',
        suspended: suspendedByUid.has(u.uid),
        suspendedReason: suspendedByUid.get(u.uid),
        isAdmin: u.isAdmin,
        providers: u.providers,
        productUpdates: optedIn.has(u.uid),
        pushDevices: devicesByUid.get(u.uid) ?? 0,
      };
    }),
  };
}

// ---- Suspending ------------------------------------------------------------------------------

async function assertCanSuspend(adminUid: string, targetUid: string): Promise<void> {
  if (targetUid === adminUid) throw new ApiError(400, "You can't suspend your own account.", 'general');
  let isAdminTarget = false;
  try {
    isAdminTarget = (await firebaseAuth.getUser(targetUid)).customClaims?.admin === true;
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/user-not-found') throw new ApiError(404, 'That account no longer exists.', 'general');
    throw err;
  }
  if (isAdminTarget) throw new ApiError(400, "Admin accounts can't be suspended from the dashboard.", 'general');
}

// Takes effect right away on this server (the account is refused on its next request) and also
// disables the Firebase account, so it can't sign in again or refresh its session.
export async function suspendUser(adminUid: string, targetUid: string, reason?: string): Promise<void> {
  await assertCanSuspend(adminUid, targetUid);
  const cleanReason = reason?.trim().slice(0, 300) || undefined;
  await AccountSuspension.updateOne(
    { firebaseUid: targetUid },
    { $set: { reason: cleanReason, suspendedByUid: adminUid }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  forgetSuspension(targetUid);
  invalidateDirectory();
  try {
    await firebaseAuth.updateUser(targetUid, { disabled: true });
    await firebaseAuth.revokeRefreshTokens(targetUid);
  } catch (err) {
    // The database flag already blocks every request; the Firebase disable is the second layer.
    console.error('[admin] suspended in the database but could not disable in Firebase', err);
  }
}

export async function restoreUser(targetUid: string): Promise<void> {
  await AccountSuspension.deleteOne({ firebaseUid: targetUid });
  forgetSuspension(targetUid);
  invalidateDirectory();
  try {
    await firebaseAuth.updateUser(targetUid, { disabled: false });
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/user-not-found') return;
    throw new ApiError(502, 'The account was restored here, but Firebase could not be updated. Try again.', 'general');
  }
}
