import { View, Text, StyleSheet, Alert } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { AddClassModal } from '@/components/plan/AddClassModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListRow } from '@/components/ui/ListRow';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Colors, Spacing } from '@/constants/theme';
import { COURSE_COLORS } from '@/constants/classColors';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { confirmDelete } from '@/utils/confirmDelete';
import { syncClassToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleClassNotifications, cancelNotifications } from '@/utils/notifications';
import { formatClassDays } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

export default function Classes() {
  const { plan, updatePlan } = usePlan();
  const { appleCalendarConnected, remindersEnabled } = useSettings();
  const sheet = useEditableSheet<ClassItem>();

  // Most-recently-created first — class ids are Date.now() timestamps, so a
  // numeric sort on id doubles as a creation-order sort. Matches the
  // Dashboard's "My Classes" ordering.
  const classes = [...plan.classes].sort((a, b) => Number(b.id) - Number(a.id));

  const handleAddOrSaveClass = async (item: ClassItem) => {
    const isEdit = plan.classes.some((c) => c.id === item.id);
    const prev = isEdit ? plan.classes.find((c) => c.id === item.id) : undefined;
    let synced = item;
    if (appleCalendarConnected) {
      try {
        // Best-effort — a calendar-write failure logs but never blocks the save.
        if (isEdit) await deleteAppleEvents(prev?.appleEventIds);
        synced = { ...synced, appleEventIds: await syncClassToAppleCalendar(item) };
      } catch (err) {
        console.error('[Classes] failed to sync class to Apple Calendar', err);
      }
    }
    if (remindersEnabled) {
      try {
        if (isEdit) await cancelNotifications(prev?.notificationIds);
        synced = { ...synced, notificationIds: await scheduleClassNotifications(item) };
      } catch (err) {
        console.error('[Classes] failed to schedule class notifications', err);
      }
    }
    try {
      // Computed inside updatePlan's updater (React's latest state), not
      // from the `plan` this closure was created with — AddClassModal closes
      // itself immediately without awaiting this save (see its onAdd call),
      // so "add a class, then immediately add another" before the first
      // save resolves is a completely normal flow, not just a rare
      // double-tap, and it used to be able to silently drop one of the two.
      await updatePlan((p) => ({
        ...p,
        classes: p.classes.some((c) => c.id === synced.id)
          ? p.classes.map((c) => (c.id === synced.id ? synced : c))
          : [...p.classes, synced],
      }));
    } catch (err) {
      console.error('[Classes] failed to save class', err);
      Alert.alert("Couldn't save class", 'Check your connection and try again.');
    }
  };

  const handleRemove = async (id: string) => {
    const removed = plan.classes.find((c) => c.id === id);
    try {
      await updatePlan((p) => ({ ...p, classes: p.classes.filter((c) => c.id !== id) }));
      if (appleCalendarConnected) await deleteAppleEvents(removed?.appleEventIds);
      if (remindersEnabled) await cancelNotifications(removed?.notificationIds);
    } catch (err) {
      console.error('[Classes] failed to remove class', err);
      Alert.alert("Couldn't remove class", 'Check your connection and try again.');
    }
  };

  const handleDeleteClass = (item: ClassItem) => {
    confirmDelete(item.courseName, () => handleRemove(item.id));
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Classes" subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'}`} />

      <View style={styles.list}>
        {classes.length === 0 ? (
          <Text style={styles.emptyText}>No classes added yet.</Text>
        ) : (
          classes.map((c) => {
            const color = COURSE_COLORS[plan.classes.indexOf(c) % COURSE_COLORS.length];
            return (
              <ListRow
                key={c.id}
                leading={{ type: 'bar', color }}
                title={c.courseName}
                meta={`${formatClassDays(c)}${c.time ? ` · ${c.time}` : ''}`}
                onLongPress={() => sheet.setActionTarget(c)}
                onMenuPress={() => sheet.setActionTarget(c)}
              />
            );
          })
        )}

        <DashedAddButton label="Add class" onPress={sheet.openNew} />
      </View>

      <AddClassModal
        visible={sheet.open}
        onClose={sheet.close}
        onAdd={handleAddOrSaveClass}
        editingClass={sheet.editing}
      />

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && sheet.openEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && handleDeleteClass(sheet.actionTarget)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  list: {
    marginTop: 20,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
