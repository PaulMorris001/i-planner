import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { GreetingHeader } from '@/components/ui/GreetingHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useOnboarding } from '@/hooks/useOnboarding';
import { TaskCategories } from '@/constants/taskMeta';

interface GoalCard {
  tag: string;
  title: string;
  pct: number;
  color: string;
}

const GOAL_CARDS: Record<'student' | 'exam' | 'professional', GoalCard[]> = {
  student: [
    { tag: 'Study', title: 'Finish Corporate Finance modules 1–3', pct: 60, color: Colors.primaryLight },
    { tag: 'Habit', title: 'Keep a 7-day study streak', pct: 71, color: Colors.primaryLight },
  ],
  exam: [
    { tag: 'Exam', title: 'Pass the SIE on first attempt', pct: 30, color: '#8B3FD1' },
    { tag: 'Habit', title: 'Study 8 hrs every week', pct: 85, color: Colors.primaryLight },
  ],
  professional: [
    { tag: 'Career', title: 'Senior Manager by Jun 2027', pct: 25, color: Colors.success },
    { tag: 'Habit', title: 'Weekly skill-building block', pct: 40, color: Colors.primaryLight },
  ],
};

function toPathKey(focusProfile: string | null): 'student' | 'exam' | 'professional' {
  if (focusProfile === 'student') return 'student';
  if (focusProfile === 'exam_candidate') return 'exam';
  return 'professional';
}

type GoalTypeId = 'study' | 'career' | 'personal' | 'habit';

const GOAL_TYPES: { id: GoalTypeId; label: string; color: string }[] = [
  { id: 'study', label: 'Study', color: Colors.primaryLight },
  { id: 'career', label: 'Career', color: TaskCategories.career.color },
  { id: 'personal', label: 'Personal', color: TaskCategories.personal.color },
  { id: 'habit', label: 'Habit', color: TaskCategories.habit.color },
];

export default function Goals() {
  const { focusProfile } = useOnboarding();
  const baseGoals = GOAL_CARDS[toPathKey(focusProfile)];
  const [addedGoals, setAddedGoals] = useState<GoalCard[]>([]);
  const goals = [...baseGoals, ...addedGoals];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalTypeId>('study');
  const [goalName, setGoalName] = useState('');

  const canSave = goalName.trim().length > 0;

  const openSheet = () => {
    setGoalType('study');
    setGoalName('');
    setSheetOpen(true);
  };

  const handleCreate = () => {
    if (!canSave) return;
    const type = GOAL_TYPES.find((t) => t.id === goalType)!;
    setAddedGoals((prev) => [...prev, { tag: type.label, title: goalName.trim(), pct: 0, color: type.color }]);
    setSheetOpen(false);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <GreetingHeader />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>ACTIVE GOALS</Text>
          <Pressable style={styles.newGoalButton} onPress={openSheet}>
            <IconSymbol name="plus" color={Colors.primaryLight} size={15} />
            <Text style={styles.newGoalText}>New goal</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {goals.map((goal, i) => (
            <View key={`${goal.title}-${i}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.tag, { color: goal.color }]}>{goal.tag.toUpperCase()}</Text>
                <Text style={styles.pct}>{goal.pct}%</Text>
              </View>
              <Text style={styles.cardTitle}>{goal.title}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${goal.pct}%`, backgroundColor: goal.color }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>New goal</Text>

          <Text style={styles.sheetEyebrow}>Type</Text>
          <View style={styles.typeRow}>
            {GOAL_TYPES.map((t) => {
              const on = goalType === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.typeChip,
                    { backgroundColor: on ? t.color : Colors.white, borderColor: on ? t.color : Colors.border },
                  ]}
                  onPress={() => setGoalType(t.id)}
                >
                  <Text style={[styles.typeChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={goalName}
            onChangeText={setGoalName}
            placeholder="Name your goal (e.g. Finish CFA Level I)"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Pressable
            style={[styles.createButton, !canSave && styles.createButtonDisabled]}
            disabled={!canSave}
            onPress={handleCreate}
          >
            <Text style={[styles.createButtonText, !canSave && styles.createButtonTextDisabled]}>Create goal</Text>
          </Pressable>
        </View>
      </Modal>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,18,40,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.offWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingTop: 14,
    paddingBottom: 30,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  createButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  createButtonDisabled: {
    backgroundColor: Colors.border,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  createButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
