import { Alert } from 'react-native';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { syncClassToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleClassNotifications, cancelNotifications } from '@/utils/notifications';
import { markClassScheduled, clearClassSchedule } from '@/utils/notificationReconcile';
import { confirmDelete } from '@/utils/confirmDelete';
import type { ClassItem } from '@/types/plan.types';

// Apple Calendar sync + notification scheduling + notification-reconcile-cache
// bookkeeping for ONE class — shared by saveClass and the bulk saveClasses
// below, so the batch path doesn't duplicate this per-item logic. Best-effort
// end to end: never throws, so a batch caller can run these in parallel via
// Promise.allSettled without one item's failure blocking or dropping any
// other (each try/catch below already means the only thing left to reject
// would be something truly unexpected).
async function syncOneClass(
  item: ClassItem,
  prevById: Map<string, ClassItem>,
  appleCalendarConnected: boolean,
  remindersEnabled: boolean
): Promise<ClassItem> {
  const isEdit = prevById.has(item.id);
  const prev = prevById.get(item.id);
  let synced = item;
  // The old event/notifications are cancelled unconditionally on edit — they're real
  // already-scheduled state regardless of the current toggle; only creating new ones
  // is gated by whether that toggle is currently on. Best-effort throughout — a
  // calendar-write failure logs but never blocks the save.
  try {
    if (isEdit) await deleteAppleEvents(prev?.appleEventIds);
    if (appleCalendarConnected) {
      synced = { ...synced, appleEventIds: await syncClassToAppleCalendar(item) };
    }
  } catch (err) {
    console.error('[useClassActions] failed to sync class to Apple Calendar', err);
  }
  try {
    if (isEdit) await cancelNotifications(prev?.notificationIds);
    if (remindersEnabled) {
      synced = { ...synced, notificationIds: await scheduleClassNotifications(item) };
    }
  } catch (err) {
    console.error('[useClassActions] failed to schedule class notifications', err);
  }
  // Records what this device actually holds now, regardless of whether the
  // save that follows succeeds — these are real on-device notifications
  // already, and the next reconcile pass (see utils/notificationReconcile.ts)
  // needs to know about them either way to avoid scheduling a duplicate set.
  try {
    await markClassScheduled(synced, synced.notificationIds ?? []);
  } catch (err) {
    console.error('[useClassActions] failed to record notification-reconcile cache', err);
  }
  return synced;
}

// Save/remove for a class, including the Apple Calendar + notification resync dance —
// shared by classes.tsx and planner.tsx (a class can be edited/deleted from either).
export function useClassActions() {
  const { plan, updatePlan } = usePlan();
  const { appleCalendarConnected, remindersEnabled } = useSettings();

  const saveClass = async (item: ClassItem) => {
    const prevById = new Map(plan.classes.map((c) => [c.id, c]));
    const synced = await syncOneClass(item, prevById, appleCalendarConnected, remindersEnabled);
    try {
      // Use updatePlan's updater (latest state), not the closure's `plan` — AddClassModal
      // doesn't await onAdd, so rapid successive adds are normal and a stale closure would drop one.
      await updatePlan((p) => ({
        ...p,
        classes: p.classes.some((c) => c.id === synced.id)
          ? p.classes.map((c) => (c.id === synced.id ? synced : c))
          : [...p.classes, synced],
      }));
    } catch (err) {
      console.error('[useClassActions] failed to save class', err);
      Alert.alert("Couldn't save class", 'Check your connection and try again.');
    }
  };

  // Bulk path — used by TimetableUploadModal's "Add to planner" confirm step
  // (and any future feature that creates several classes at once). Per-item
  // Apple/notification sync runs in PARALLEL via Promise.allSettled, then the
  // whole resulting array commits via exactly ONE updatePlan call — not N
  // sequential network round-trips the way N individual saveClass calls
  // would cost.
  const saveClasses = async (items: ClassItem[]): Promise<{ saved: ClassItem[]; failedCount: number }> => {
    const prevById = new Map(plan.classes.map((c) => [c.id, c]));
    const results = await Promise.allSettled(
      items.map((item) => syncOneClass(item, prevById, appleCalendarConnected, remindersEnabled))
    );
    const synced = results
      .filter((r): r is PromiseFulfilledResult<ClassItem> => r.status === 'fulfilled')
      .map((r) => r.value);
    const failedCount = results.length - synced.length;
    try {
      await updatePlan((p) => {
        const byId = new Map(p.classes.map((c) => [c.id, c]));
        for (const c of synced) byId.set(c.id, c); // replace-by-id or append
        return { ...p, classes: Array.from(byId.values()) };
      });
    } catch (err) {
      console.error('[useClassActions] failed to save classes', err);
      Alert.alert("Couldn't save classes", 'Check your connection and try again.');
      return { saved: [], failedCount: items.length };
    }
    return { saved: synced, failedCount };
  };

  const removeClass = async (id: string) => {
    const removed = plan.classes.find((c) => c.id === id);
    try {
      await updatePlan((p) => ({ ...p, classes: p.classes.filter((c) => c.id !== id) }));
      // Unconditional — real already-scheduled state that would otherwise orphan: the
      // class is gone, so nothing would ever catch and cancel them later.
      await deleteAppleEvents(removed?.appleEventIds);
      await cancelNotifications(removed?.notificationIds);
      await clearClassSchedule(id);
    } catch (err) {
      console.error('[useClassActions] failed to remove class', err);
      Alert.alert("Couldn't remove class", 'Check your connection and try again.');
    }
  };

  const deleteClass = (item: ClassItem) => {
    confirmDelete(item.courseName, () => removeClass(item.id));
  };

  return { saveClass, saveClasses, removeClass, deleteClass };
}
