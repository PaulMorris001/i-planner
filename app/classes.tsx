import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AddClassModal } from '@/components/plan/AddClassModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { Colors, Spacing } from '@/constants/theme';
import { COURSE_COLORS } from '@/constants/classColors';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { confirmDelete } from '@/utils/confirmDelete';
import { syncClassToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import type { ClassItem } from '@/types/plan.types';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function classDaysLabel(item: ClassItem): string {
  if (!item.recurring) return 'One time';
  if (item.freq === 'monthly') return 'Monthly';
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join(' · ');
}

export default function Classes() {
  const router = useRouter();
  const { plan, savePlan } = usePlan();
  const { appleCalendarConnected } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [actionSheetTarget, setActionSheetTarget] = useState<ClassItem | null>(null);

  // Most-recently-created first — class ids are Date.now() timestamps, so a
  // numeric sort on id doubles as a creation-order sort. Matches the
  // Dashboard's "My Classes" ordering.
  const classes = [...plan.classes].sort((a, b) => Number(b.id) - Number(a.id));

  const handleAddOrSaveClass = async (item: ClassItem) => {
    const isEdit = plan.classes.some((c) => c.id === item.id);
    let synced = item;
    if (appleCalendarConnected) {
      try {
        // Best-effort — a calendar-write failure logs but never blocks the save.
        if (isEdit) {
          const prev = plan.classes.find((c) => c.id === item.id);
          await deleteAppleEvents(prev?.appleEventIds);
        }
        synced = { ...item, appleEventIds: await syncClassToAppleCalendar(item) };
      } catch (err) {
        console.error('[Classes] failed to sync class to Apple Calendar', err);
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
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Classes</Text>
      <Text style={styles.subtitle}>
        {classes.length} class{classes.length === 1 ? '' : 'es'}
      </Text>

      <View style={styles.list}>
        {classes.length === 0 ? (
          <Text style={styles.emptyText}>No classes added yet.</Text>
        ) : (
          classes.map((c) => {
            const color = COURSE_COLORS[plan.classes.indexOf(c) % COURSE_COLORS.length];
            return (
              <Pressable
                key={c.id}
                style={styles.classRow}
                onLongPress={() => setActionSheetTarget(c)}
              >
                <View style={[styles.classBar, { backgroundColor: color }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.classRowTitle} numberOfLines={1}>{c.courseName}</Text>
                  <Text style={styles.classRowMeta}>{classDaysLabel(c)}{c.time ? ` · ${c.time}` : ''}</Text>
                </View>
                <Pressable onPress={() => setActionSheetTarget(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
                </Pressable>
              </Pressable>
            );
          })
        )}

        <Pressable style={styles.addButton} onPress={() => setModalOpen(true)}>
          <IconSymbol name="plus" color={Colors.primaryLight} size={18} />
          <Text style={styles.addButtonText}>Add class</Text>
        </Pressable>
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
    paddingHorizontal: Spacing.md,
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
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  classBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  classRowTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  classRowMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  addButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
