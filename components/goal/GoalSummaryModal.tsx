import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Colors, Spacing } from '@/constants/theme';
import { formatMonthYear } from '@/utils/date';
import { useGoals } from '@/hooks/useGoals';
import type { Goal } from '@/types/goal.types';

interface GoalSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  goal: Goal | null;
}

// Summary of a single goal — used by the Dashboard's "View" action so a user can
// check progress and tick off milestones without leaving the home page. Full
// editing (title, type, target fields) still only happens on the Goals page.
export function GoalSummaryModal({ visible, onClose, goal }: GoalSummaryModalProps) {
  const { updateGoal } = useGoals();

  if (!goal) return null;

  const subtitle = [goal.targetRole, goal.targetIndustry, goal.targetDate ? formatMonthYear(goal.targetDate) : '']
    .filter(Boolean)
    .join(' · ');
  const milestonesDone = goal.milestones.filter((m) => m.done).length;

  const toggleMilestone = (milestoneId: string) => {
    const updated = goal.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
    updateGoal(goal.id, { milestones: updated }).catch((err) => {
      console.error('[GoalSummaryModal] failed to update milestone', err);
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={75}>
      <View style={styles.headerRow}>
        <Text style={[styles.tag, { color: goal.color }]}>{goal.tag.toUpperCase()}</Text>
        <Text style={styles.pct}>{goal.pct}%</Text>
      </View>
      <Text style={styles.title}>{goal.title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.progressTrack}>
        <AnimatedProgressBar pct={goal.pct} color={goal.color} />
      </View>
      {goal.milestones.length > 0 && (
        <Text style={styles.milestoneCount}>{milestonesDone} / {goal.milestones.length} milestones</Text>
      )}

      {goal.milestones.length > 0 && (
        <ScrollView style={styles.milestoneList} keyboardShouldPersistTaps="handled">
          {goal.milestones.map((m) => (
            <Pressable key={m.id} style={styles.milestoneRow} onPress={() => toggleMilestone(m.id)}>
              <View style={[styles.checkbox, m.done && { backgroundColor: goal.color, borderColor: goal.color }]}>
                {m.done && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.milestoneTextBlock}>
                <Text style={[styles.milestoneTitle, m.done && styles.milestoneTitleDone]} numberOfLines={2}>
                  {m.title}
                </Text>
                {!!m.dueLabel && <Text style={styles.milestoneDue}>{m.dueLabel}</Text>}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pct: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 16,
    overflow: 'hidden',
  },
  milestoneCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 6,
  },
  milestoneList: {
    marginTop: 14,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  milestoneTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  milestoneTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  milestoneTitleDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  milestoneDue: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    backgroundColor: Colors.offWhite,
    borderRadius: 14,
    paddingVertical: 14,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
