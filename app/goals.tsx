import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NewGoalModal } from '@/components/goal/NewGoalModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { GoalsSkeleton } from '@/components/ui/GoalsSkeleton';
import { confirmDelete } from '@/utils/confirmDelete';
import { Colors, Spacing } from '@/constants/theme';
import { useGoals } from '@/hooks/useGoals';
import type { Goal, Milestone } from '@/types/goal.types';

export default function Goals() {
  const router = useRouter();
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionSheetTarget, setActionSheetTarget] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const toggleMilestone = (goalId: string, milestones: Milestone[], milestoneId: string) => {
    const updated = milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
    updateGoal(goalId, { milestones: updated }).catch((err) => {
      console.error('[Goals] failed to update milestone', err);
    });
  };

  const handleSaveGoal = async (
    id: string,
    patch: { title: string; type: Goal['type']; tag: string; color: string; targetRole?: string; targetIndustry?: string; targetDate?: string }
  ) => {
    await updateGoal(id, patch);
  };

  const handleDeleteGoal = (goal: Goal) => {
    confirmDelete(goal.title, () => {
      deleteGoal(goal.id).catch((err) => {
        console.error('[Goals] failed to delete goal', err);
      });
    });
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent} edges={['top', 'right', 'left']}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>ACTIVE GOALS</Text>
          <Pressable style={styles.newGoalButton} onPress={() => setSheetOpen(true)}>
            <IconSymbol name="plus" color={Colors.primaryLight} size={15} />
            <Text style={styles.newGoalText}>New goal</Text>
          </Pressable>
        </View>

        {loading ? (
          <GoalsSkeleton />
        ) : goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No goals yet</Text>
            <Text style={styles.emptyStateSub}>Tap "New goal" to start tracking one.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {goals.map((goal) => (
              <Pressable
                key={goal.id}
                style={styles.card}
                onLongPress={() => setActionSheetTarget(goal)}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.tag, { color: goal.color }]}>{goal.tag.toUpperCase()}</Text>
                  <View style={styles.cardHeaderRight}>
                    <Text style={styles.pct}>{goal.pct}%</Text>
                    <Pressable
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setActionSheetTarget(goal)}
                    >
                      <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{goal.title}</Text>
                <View style={styles.progressTrack}>
                  <AnimatedProgressBar pct={goal.pct} color={goal.color} />
                </View>

                {goal.milestones.length > 0 && (
                  <View style={styles.milestoneList}>
                    {goal.milestones.map((m) => (
                      <Pressable
                        key={m.id}
                        style={styles.milestoneRow}
                        onPress={() => toggleMilestone(goal.id, goal.milestones, m.id)}
                      >
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
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <NewGoalModal
        visible={sheetOpen || !!editingGoal}
        onClose={() => {
          setSheetOpen(false);
          setEditingGoal(null);
        }}
        onCreate={createGoal}
        editingGoal={editingGoal}
        onSave={handleSaveGoal}
      />

      <ItemActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        onEdit={() => actionSheetTarget && setEditingGoal(actionSheetTarget)}
        onDelete={() => actionSheetTarget && handleDeleteGoal(actionSheetTarget)}
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
  body: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.infoSoft,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  newGoalText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  list: {
    gap: 11,
  },
  emptyState: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyStateSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tag: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pct: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 6,
    lineHeight: 20,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 11,
    overflow: 'hidden',
  },
  milestoneList: {
    marginTop: 14,
    gap: 9,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
});
