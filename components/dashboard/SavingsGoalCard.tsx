import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Colors, Radius } from '@/constants/theme';
import { formatCurrency, monthlySavingsAmount } from '@/utils/currency';
import { dashboardStyles as styles } from './dashboardStyles';
import type { SavingsGoal } from '@/types/settings.types';

interface SavingsGoalCardProps {
  goal: SavingsGoal | null | undefined;
  // Path-flavored empty-state copy (each dashboard's "budget for" context differs).
  emptySubtitle: string;
  onPress: () => void;
}

// Shared by all three dashboards (Student/Exam/Professional) — the goal itself is
// stored on Settings, not any one path's plan, since a user only ever sees one
// dashboard at a time and there's no reason for three independent goals.
export function SavingsGoalCard({ goal, emptySubtitle, onPress }: SavingsGoalCardProps) {
  const monthly = goal ? monthlySavingsAmount(goal.targetAmount, goal.savedAmount, goal.targetDate) : null;

  return (
    <Card style={styles.card}>
      {goal ? (
        <Pressable onPress={onPress}>
          <Text style={styles.classRowTitle}>{goal.name}</Text>
          <View style={localStyles.progressTrack}>
            <AnimatedProgressBar
              pct={Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))}
              color={Colors.warning}
            />
          </View>
          <Text style={styles.classRowMeta}>
            {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)} saved
          </Text>
          {monthly !== null && (
            <View style={localStyles.hintBox}>
              <IconSymbol name="info.circle" color={Colors.warning} size={14} />
              <Text style={localStyles.hintText}>Set aside {formatCurrency(monthly)}/mo to reach your goal</Text>
            </View>
          )}
        </Pressable>
      ) : (
        <EmptyState icon="plus" title="Set a savings goal" subtitle={emptySubtitle} onPress={onPress} />
      )}
    </Card>
  );
}

const localStyles = StyleSheet.create({
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 10,
  },
  hintText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.warning,
    flex: 1,
  },
});
