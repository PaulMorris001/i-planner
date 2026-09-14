import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleTaskNotifications,
  scheduleClassNotifications,
  scheduleBillNotifications,
  scheduleSavingsGoalNotifications,
  cancelNotifications,
} from '@/utils/notifications';
import { classRecurrenceEnded } from '@/utils/date';
import type { Task } from '@/types/task.types';
import type { ClassItem } from '@/types/plan.types';
import type { Bill } from '@/types/bill.types';
import type { SavingsGoal } from '@/types/savingsGoal.types';

type ScheduleCacheEntry = { sig: string; ids: string[] };
type ScheduleCache = Record<string, ScheduleCacheEntry>;

const TASK_CACHE_KEY = 'notif-schedule-cache:tasks:v1';
const CLASS_CACHE_KEY = 'notif-schedule-cache:classes:v1';
const BILL_CACHE_KEY = 'notif-schedule-cache:bills:v1';
const SAVINGS_GOAL_CACHE_KEY = 'notif-schedule-cache:savings-goals:v1';

async function readCache(key: string): Promise<ScheduleCache> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ScheduleCache) : {};
  } catch (err) {
    console.error('[notificationReconcile] failed to read schedule cache', err);
    return {};
  }
}

async function writeCache(key: string, cache: ScheduleCache): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(cache));
  } catch (err) {
    console.error('[notificationReconcile] failed to persist schedule cache', err);
  }
}

// Every exported function below does read-cache -> mutate -> write-cache.
// Two of them racing on the *same* cache (e.g. a reconcile pass triggered by
// a foreground refetch landing while createTask's own markTaskScheduled
// call for a just-created task is still in flight) would let the second
// write silently clobber the first's — the classic lost-update race,
// same class of bug pendingMutations.ts already exists to prevent for
// server writes. Chaining every mutation for a given cache key onto the same
// promise serializes them without blocking unrelated cache keys (tasks vs.
// classes vs. bills vs. savings goals) against each other.
const cacheLocks = new Map<string, Promise<unknown>>();
function withCacheLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = cacheLocks.get(key) ?? Promise.resolve();
  const settled = prior.then(fn, fn);
  cacheLocks.set(key, settled.catch(() => {}));
  return settled;
}

// Only the fields that actually feed into scheduleTaskNotifications, plus
// `done` — which isn't a scheduling input itself, but determines eligibility
// (a completed one-time task should have no reminder at all; see
// TasksContext.toggleDone's done-branch, which this mirrors). `done` is
// excluded for a recurring task: its reminder repeats on a weekday/freq
// basis and isn't tied to any single date's completedDates entry.
function taskSignature(t: Task): string {
  return JSON.stringify([
    t.title, t.dueDate, t.time, t.recurring, t.freq ?? null,
    t.dayIdxs ?? null, t.alarmEnabled ?? false, t.recurring ? null : t.done,
  ]);
}

function classSignature(c: ClassItem): string {
  return JSON.stringify([
    c.courseName, c.startDate, c.endDate ?? null, c.time, c.recurring, c.freq, c.dayIdxs, c.alarmEnabled ?? false,
    // Crossing the end date needs to flip the signature too, or reconcile
    // would never notice a class's semester just ended and stop re-arming
    // its (already-scheduled, now-stale) reminder — same reasoning as
    // savingsGoalSignature's "already fully saved" threshold below.
    classRecurrenceEnded(c),
  ]);
}

// Mirrors scheduleBillNotifications' inputs — name/amount feed into the
// scheduled body text, dueDate/recurring drive the trigger itself.
function billSignature(b: Bill): string {
  return JSON.stringify([b.name, b.amount, b.dueDate, b.recurring]);
}

// savedAmount is included even though it isn't a scheduling *input* the way
// name is (the check-in body doesn't quote a progress figure) — it's what
// scheduleSavingsGoalNotifications' own "already fully saved, don't nag"
// eligibility check reads, so crossing that threshold must flip the
// signature too, or reconcile would never notice a goal just got paid off
// and stop pestering the user about it.
function savingsGoalSignature(g: SavingsGoal): string {
  return JSON.stringify([g.name, g.targetAmount, g.savedAmount >= g.targetAmount]);
}

// Shared by both entity kinds below. `next` is always the full, authoritative
// list just fetched from the server — an id present in the cache but missing
// from `next` means the item was deleted (by any device) since this device
// last saw it, so its schedule is cancelled and dropped rather than left
// orphaned forever.
async function reconcile<T extends { id: string; notificationIds?: string[] }>(
  cacheKey: string,
  next: T[],
  remindersEnabled: boolean,
  signatureOf: (item: T) => string,
  schedule: (item: T) => Promise<string[]>
): Promise<T[]> {
  if (!remindersEnabled) return next;

  return withCacheLock(cacheKey, async () => {
    const cache = await readCache(cacheKey);
    const nextIds = new Set(next.map((item) => item.id));
    const staleIds = Object.keys(cache).filter((id) => !nextIds.has(id));
    if (staleIds.length) {
      await Promise.all(staleIds.map((id) => cancelNotifications(cache[id].ids)));
      for (const id of staleIds) delete cache[id];
    }

    const result = await Promise.all(
      next.map(async (item) => {
        const sig = signatureOf(item);
        const cached = cache[item.id];
        if (cached && cached.sig === sig) {
          // Nothing schedule-relevant changed since this device last saw it —
          // report this device's own known-good ids, not whatever the server
          // copy happens to hold (that may belong to a different device).
          return { ...item, notificationIds: cached.ids };
        }
        if (cached?.ids.length) await cancelNotifications(cached.ids);
        const ids = await schedule(item);
        cache[item.id] = { sig, ids };
        return { ...item, notificationIds: ids };
      })
    );

    await writeCache(cacheKey, cache);
    return result;
  });
}

// Called from TasksContext's fetchTasks (mount, foreground refetch, and
// pull-to-refresh all funnel through it) — never needs a separate "skip on
// first run" case, since the persisted cache already makes a cold launch
// safe: a fresh install has no cache entries and correctly schedules
// everything once; a relaunch has last session's entries and correctly
// reschedules only what actually changed.
export async function reconcileTaskNotifications(next: Task[], remindersEnabled: boolean): Promise<Task[]> {
  return reconcile(TASK_CACHE_KEY, next, remindersEnabled, taskSignature, (t) =>
    t.recurring || !t.done ? scheduleTaskNotifications(t) : Promise.resolve([])
  );
}

export async function reconcileClassNotifications(next: ClassItem[], remindersEnabled: boolean): Promise<ClassItem[]> {
  return reconcile(CLASS_CACHE_KEY, next, remindersEnabled, classSignature, (c) => scheduleClassNotifications(c));
}

export async function reconcileBillNotifications(next: Bill[], remindersEnabled: boolean): Promise<Bill[]> {
  return reconcile(BILL_CACHE_KEY, next, remindersEnabled, billSignature, (b) => scheduleBillNotifications(b));
}

export async function reconcileSavingsGoalNotifications(next: SavingsGoal[], remindersEnabled: boolean): Promise<SavingsGoal[]> {
  return reconcile(SAVINGS_GOAL_CACHE_KEY, next, remindersEnabled, savingsGoalSignature, (g) =>
    scheduleSavingsGoalNotifications(g)
  );
}

// The CRUD flows (TasksContext's createTask/toggleDone/updateTask/removeTask,
// useClassActions' saveClass/removeClass) already schedule/cancel this
// device's own notifications directly, outside of the reconcile pass above —
// they must report the result into the same cache, or the next reconcile run
// (the very next foreground/pull-to-refresh) would find no matching cache
// entry, treat the item as unseen, and schedule a duplicate set alongside the
// one these flows just created.
export async function markTaskScheduled(task: Task, notificationIds: string[]): Promise<void> {
  await withCacheLock(TASK_CACHE_KEY, async () => {
    const cache = await readCache(TASK_CACHE_KEY);
    cache[task.id] = { sig: taskSignature(task), ids: notificationIds };
    await writeCache(TASK_CACHE_KEY, cache);
  });
}

export async function clearTaskSchedule(taskId: string): Promise<void> {
  await withCacheLock(TASK_CACHE_KEY, async () => {
    const cache = await readCache(TASK_CACHE_KEY);
    if (taskId in cache) {
      delete cache[taskId];
      await writeCache(TASK_CACHE_KEY, cache);
    }
  });
}

export async function markClassScheduled(item: ClassItem, notificationIds: string[]): Promise<void> {
  await withCacheLock(CLASS_CACHE_KEY, async () => {
    const cache = await readCache(CLASS_CACHE_KEY);
    cache[item.id] = { sig: classSignature(item), ids: notificationIds };
    await writeCache(CLASS_CACHE_KEY, cache);
  });
}

export async function clearClassSchedule(itemId: string): Promise<void> {
  await withCacheLock(CLASS_CACHE_KEY, async () => {
    const cache = await readCache(CLASS_CACHE_KEY);
    if (itemId in cache) {
      delete cache[itemId];
      await writeCache(CLASS_CACHE_KEY, cache);
    }
  });
}

export async function markBillScheduled(bill: Bill, notificationIds: string[]): Promise<void> {
  await withCacheLock(BILL_CACHE_KEY, async () => {
    const cache = await readCache(BILL_CACHE_KEY);
    cache[bill.id] = { sig: billSignature(bill), ids: notificationIds };
    await writeCache(BILL_CACHE_KEY, cache);
  });
}

export async function clearBillSchedule(billId: string): Promise<void> {
  await withCacheLock(BILL_CACHE_KEY, async () => {
    const cache = await readCache(BILL_CACHE_KEY);
    if (billId in cache) {
      delete cache[billId];
      await writeCache(BILL_CACHE_KEY, cache);
    }
  });
}

export async function markSavingsGoalScheduled(goal: SavingsGoal, notificationIds: string[]): Promise<void> {
  await withCacheLock(SAVINGS_GOAL_CACHE_KEY, async () => {
    const cache = await readCache(SAVINGS_GOAL_CACHE_KEY);
    cache[goal.id] = { sig: savingsGoalSignature(goal), ids: notificationIds };
    await writeCache(SAVINGS_GOAL_CACHE_KEY, cache);
  });
}

export async function clearSavingsGoalSchedule(goalId: string): Promise<void> {
  await withCacheLock(SAVINGS_GOAL_CACHE_KEY, async () => {
    const cache = await readCache(SAVINGS_GOAL_CACHE_KEY);
    if (goalId in cache) {
      delete cache[goalId];
      await writeCache(SAVINGS_GOAL_CACHE_KEY, cache);
    }
  });
}
