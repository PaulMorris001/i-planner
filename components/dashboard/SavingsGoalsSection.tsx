import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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

  return (
    <View>
      <View style={localStyles.headerRow}>
        <Text style={[styles.eyebrowMuted, localStyles.eyebrowWarning]}>SAVINGS GOALS</Text>
        <Pressable style={localStyles.addBtn} onPress={onAdd}>
          <Text style={localStyles.addBtnText}>+ Add goal</Text>
        </Pressable>
      </View>

      {goals.length === 0 ? (
        <EmptyState
          icon="plus"
          title="Set a savings goal"
          subtitle={emptySubtitle}
          onPress={onAdd}
        />
      ) : (
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
      )}

      <ViewMoreToggle
        expanded={expanded}
        onPress={() => setExpanded((p) => !p)}
        hiddenCount={Math.max(0, goals.length - PREVIEW_COUNT)}
      />
    </View>
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
