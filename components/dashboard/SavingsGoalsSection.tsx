import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ViewMoreToggle } from '@/components/ui/ViewMoreToggle';
import { SavingsGoalCard } from '@/components/dashboard/SavingsGoalCard';
import { Colors, Radius } from '@/constants/theme';
import { dashboardStyles as styles } from './dashboardStyles';
import type { SavingsGoal } from '@/types/savingsGoal.types';

interface SavingsGoalsSectionProps {
  goals: SavingsGoal[];
  // Path-flavored empty-state copy (each dashboard's "budget for" context differs).
  emptySubtitle: string;
  onAdd: () => void;
  onEditGoal: (goal: SavingsGoal) => void;
  onLogProgress: (goal: SavingsGoal) => void;
}

// Each card is fairly tall (name + progress bar + Log progress button), so the
// preview cap is smaller than Bill Reminders' — 2 keeps the dashboard from
// growing unbounded before the user opts in to see more.
const PREVIEW_COUNT = 2;

// Section wrapper for multiple savings goals — same header/"+Add"/ViewMoreToggle
// shape as BillRemindersSection, but each row is a full SavingsGoalCard (reused
// as-is, one per goal) rather than a compact list row, since each goal needs its
// own progress bar and "Log progress" action.
export function SavingsGoalsSection({ goals, emptySubtitle, onAdd, onEditGoal, onLogProgress }: SavingsGoalsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? goals : goals.slice(0, PREVIEW_COUNT);

  const headerRow = (
    <View style={localStyles.headerRow}>
      <Text style={[styles.eyebrowMuted, localStyles.eyebrowWarning]}>SAVINGS GOALS</Text>
      <Pressable style={localStyles.addBtn} onPress={onAdd}>
        <Text style={localStyles.addBtnText}>+ Add goal</Text>
      </Pressable>
    </View>
  );

  if (goals.length === 0) {
    // Same bordered-white-card shell as the Career Goal card above it, instead
    // of floating loose against the page background — keeps every dashboard
    // section reading as its own distinct block regardless of empty/filled state.
    return (
      <Card style={[styles.card, localStyles.section]}>
        {headerRow}
        <EmptyState icon="plus" title="Set a savings goal" subtitle={emptySubtitle} onPress={onAdd} />
      </Card>
    );
  }

  return (
    <View style={localStyles.section}>
      {headerRow}

      <View style={{ gap: 12, marginTop: 11 }}>
        {visible.map((goal) => (
          <SavingsGoalCard
            key={goal.id}
            goal={goal}
            emptySubtitle={emptySubtitle}
            onPress={() => onEditGoal(goal)}
            onLogProgress={() => onLogProgress(goal)}
          />
        ))}
      </View>

      <ViewMoreToggle
        expanded={expanded}
        onPress={() => setExpanded((p) => !p)}
        hiddenCount={Math.max(0, goals.length - PREVIEW_COUNT)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  // A little extra room on top of the dashboard stack's own gap between
  // sections — Bill Reminders/Savings Goals/AI Coach otherwise read as
  // crowded against each other since none of the section headers carry any
  // spacing of their own the way a bordered Card's padding naturally would.
  section: {
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowWarning: {
    color: Colors.warning,
  },
  addBtn: {
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.warning,
  },
});
