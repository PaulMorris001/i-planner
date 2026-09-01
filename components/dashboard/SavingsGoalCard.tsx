import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Colors, Radius } from '@/constants/theme';
import { formatCurrency, monthlySavingsAmount } from '@/utils/currency';
import { formatMonthYear } from '@/utils/date';
import { dashboardStyles as styles } from './dashboardStyles';
import type { SavingsGoal } from '@/types/savingsGoal.types';

interface SavingsGoalCardProps {
  goal: SavingsGoal | null | undefined;
  // Path-flavored empty-state copy (each dashboard's "budget for" context differs).
  emptySubtitle: string;
  onPress: () => void;
  onLogProgress: () => void;
}

// Shared by all three dashboards (Student/Exam/Professional) — the goal itself is
// stored on Settings, not any one path's plan, since a user only ever sees one
// dashboard at a time and there's no reason for three independent goals.
export function SavingsGoalCard({ goal, emptySubtitle, onPress, onLogProgress }: SavingsGoalCardProps) {
  const pct = goal ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const monthly = goal ? monthlySavingsAmount(goal.targetAmount, goal.savedAmount, goal.targetDate) : null;

  return (
    <Card style={styles.card}>
      {goal ? (
        <View>
          <Pressable onPress={onPress}>
            <View style={localStyles.headerRow}>
              <Text style={[styles.eyebrowMuted, localStyles.eyebrowWarning]}>SAVINGS</Text>
              <Text style={styles.mono}>{pct}%</Text>
            </View>
            <Text style={localStyles.goalName}>{goal.name}</Text>
            <Text style={localStyles.amountLine}>
              <Text style={localStyles.amountBig}>{formatCurrency(goal.savedAmount)}</Text>
              <Text style={localStyles.amountMuted}>
                {' '}
                of {formatCurrency(goal.targetAmount)}
                {goal.targetDate ? ` · by ${formatMonthYear(goal.targetDate)}` : ''}
              </Text>
            </Text>
            <View style={localStyles.progressTrack}>
              <AnimatedProgressBar pct={pct} color={Colors.warning} />
            </View>
          </Pressable>

          <View style={localStyles.footerRow}>
            {monthly !== null ? (
              <Text style={localStyles.footerHint} numberOfLines={1}>
                Save {formatCurrency(monthly)}/mo to stay on track
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable style={localStyles.logBtn} onPress={onLogProgress}>
              <Text style={localStyles.logBtnText}>Log progress</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <EmptyState icon="plus" title="Set a savings goal" subtitle={emptySubtitle} onPress={onPress} />
      )}
    </Card>
  );
}

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowWarning: {
    color: Colors.warning,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  amountLine: {
    marginTop: 2,
  },
  amountBig: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  footerHint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  logBtn: {
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  logBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
});
