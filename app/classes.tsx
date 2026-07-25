import { useState } from 'react';
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
import { confirmDelete } from '@/utils/confirmDelete';
import { syncClassToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleClassNotifications, cancelNotifications } from '@/utils/notifications';
import type { ClassItem } from '@/types/plan.types';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function classDaysLabel(item: ClassItem): string {
  if (!item.recurring) return 'One time';
  if (item.freq === 'monthly') return 'Monthly';
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join(' · ');
}

export default function Classes() {
  const { plan, savePlan } = usePlan();
  const { appleCalendarConnected, remindersEnabled } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [actionSheetTarget, setActionSheetTarget] = useState<ClassItem | null>(null);

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
      await savePlan({
        ...plan,
        classes: isEdit
          ? plan.classes.map((c) => (c.id === synced.id ? synced : c))
          : [...plan.classes, synced],
      });
    } catch (err) {
      console.error('[Classes] failed to save class', err);
      Alert.alert("Couldn't save class", 'Check your connection and try again.');
    }
  };

  const handleRemove = async (id: string) => {
    const prevClasses = plan.classes;
    const removed = plan.classes.find((c) => c.id === id);
    try {
      await savePlan({ ...plan, classes: plan.classes.filter((c) => c.id !== id) });
      if (appleCalendarConnected) await deleteAppleEvents(removed?.appleEventIds);
      if (remindersEnabled) await cancelNotifications(removed?.notificationIds);
    } catch (err) {
      await savePlan({ ...plan, classes: prevClasses });
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
                meta={`${classDaysLabel(c)}${c.time ? ` · ${c.time}` : ''}`}
                onLongPress={() => setActionSheetTarget(c)}
                onMenuPress={() => setActionSheetTarget(c)}
              />
            );
          })
        )}

        <DashedAddButton label="Add class" onPress={() => setModalOpen(true)} />
      </View>

      <AddClassModal
        visible={modalOpen || !!editingClass}
        onClose={() => {
          setModalOpen(false);
          setEditingClass(null);
        }}
        onAdd={handleAddOrSaveClass}
        editingClass={editingClass}
      />

      <ItemActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        onEdit={() => actionSheetTarget && setEditingClass(actionSheetTarget)}
        onDelete={() => actionSheetTarget && handleDeleteClass(actionSheetTarget)}
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
