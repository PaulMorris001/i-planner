import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { GreetingHeader } from '@/components/ui/GreetingHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NewGoalModal } from '@/components/goal/NewGoalModal';
import { Colors, Spacing } from '@/constants/theme';
import { useGoals } from '@/hooks/useGoals';
import type { Milestone } from '@/types/goal.types';

export default function Goals() {
  const { goals, createGoal, updateGoal } = useGoals();
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggleMilestone = (goalId: string, milestones: Milestone[], milestoneId: string) => {
    const updated = milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
    updateGoal(goalId, { milestones: updated }).catch((err) => {
      console.error('[Goals] failed to update milestone', err);
    });
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent} edges={['top', 'right', 'left']}>
      <GreetingHeader />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>ACTIVE GOALS</Text>
          <Pressable style={styles.newGoalButton} onPress={() => setSheetOpen(true)}>
            <IconSymbol name="plus" color={Colors.primaryLight} size={15} />
            <Text style={styles.newGoalText}>New goal</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No goals yet</Text>
            <Text style={styles.emptyStateSub}>Tap "New goal" to start tracking one.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {goals.map((goal) => (
              <View key={goal.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.tag, { color: goal.color }]}>{goal.tag.toUpperCase()}</Text>
                  <Text style={styles.pct}>{goal.pct}%</Text>
                </View>
                <Text style={styles.cardTitle}>{goal.title}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${goal.pct}%`, backgroundColor: goal.color }]} />
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
              </View>
            ))}
          </View>
        )}
      </View>

      <NewGoalModal visible={sheetOpen} onClose={() => setSheetOpen(false)} onCreate={createGoal} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
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
  progressFill: {
    height: '100%',
    borderRadius: 999,
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
