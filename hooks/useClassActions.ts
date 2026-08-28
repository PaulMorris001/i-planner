import { Alert } from 'react-native';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { syncClassToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleClassNotifications, cancelNotifications } from '@/utils/notifications';
import { confirmDelete } from '@/utils/confirmDelete';
import type { ClassItem } from '@/types/plan.types';

// Save/remove for a class, including the Apple Calendar + notification resync dance —
// shared by classes.tsx and planner.tsx (a class can be edited/deleted from either).
export function useClassActions() {
  const { plan, updatePlan } = usePlan();
  const { appleCalendarConnected, remindersEnabled } = useSettings();

  const saveClass = async (item: ClassItem) => {
    const isEdit = plan.classes.some((c) => c.id === item.id);
    const prev = isEdit ? plan.classes.find((c) => c.id === item.id) : undefined;
    let synced = item;
    if (appleCalendarConnected) {
      try {
        // Best-effort — a calendar-write failure logs but never blocks the save.
        if (isEdit) await deleteAppleEvents(prev?.appleEventIds);
        synced = { ...synced, appleEventIds: await syncClassToAppleCalendar(item) };
      } catch (err) {
        console.error('[useClassActions] failed to sync class to Apple Calendar', err);
      }
    }
    if (remindersEnabled) {
      try {
        if (isEdit) await cancelNotifications(prev?.notificationIds);
        synced = { ...synced, notificationIds: await scheduleClassNotifications(item) };
      } catch (err) {
        console.error('[useClassActions] failed to schedule class notifications', err);
      }
    }
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

  const removeClass = async (id: string) => {
    const removed = plan.classes.find((c) => c.id === id);
    try {
      await updatePlan((p) => ({ ...p, classes: p.classes.filter((c) => c.id !== id) }));
      if (appleCalendarConnected) await deleteAppleEvents(removed?.appleEventIds);
      if (remindersEnabled) await cancelNotifications(removed?.notificationIds);
    } catch (err) {
      console.error('[useClassActions] failed to remove class', err);
      Alert.alert("Couldn't remove class", 'Check your connection and try again.');
    }
  };

  const deleteClass = (item: ClassItem) => {
    confirmDelete(item.courseName, () => removeClass(item.id));
  };

  return { saveClass, removeClass, deleteClass };
}
