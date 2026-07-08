import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskCategoryId } from '@/constants/taskMeta';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TODAY_IDX = 1;

const CATEGORY_ORDER: TaskCategoryId[] = ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'];

interface Habit {
  id: string;
  name: string;
  category: TaskCategoryId;
  streak: number;
  week: boolean[];
}

const SEED_HABITS: Habit[] = [
  { id: 'h1', name: 'Morning study block', category: 'academic', streak: 5, week: [true, true, false, false, false, false, false] },
  { id: 'h2', name: 'Read 20 pages', category: 'personal', streak: 12, week: [true, true, false, false, false, false, false] },
  { id: 'h3', name: 'Log spending', category: 'financial', streak: 3, week: [true, false, false, false, false, false, false] },
];

export default function Habits() {
  const router = useRouter();
  const [habits, setHabits] = useState(SEED_HABITS);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState<TaskCategoryId>('academic');

  const doneToday = habits.filter((h) => h.week[TODAY_IDX]).length;
  const canSave = habitName.trim().length > 0;

  const toggleToday = (id: string) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, week: h.week.map((on, i) => (i === TODAY_IDX ? !on : on)) }
          : h
      )
    );
  };

  const openSheet = () => {
    setHabitName('');
    setHabitCategory('academic');
    setSheetOpen(true);
  };

  const handleCreate = () => {
    if (!canSave) return;
    setHabits((prev) => [
      ...prev,
      {
        id: `h${Date.now()}`,
        name: habitName.trim(),
        category: habitCategory,
        streak: 0,
        week: [false, false, false, false, false, false, false],
      },
    ]);
    setSheetOpen(false);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Habits</Text>
      <Text style={styles.subtitle}>
        {doneToday} of {habits.length} done today
      </Text>

      <View style={styles.list}>
        {habits.map((habit) => {
          const category = TaskCategories[habit.category];
          const done = habit.week[TODAY_IDX];
          return (
            <View key={habit.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <View style={styles.streakRow}>
                    <IconSymbol name="flame.fill" color={category.color} size={13} />
                    <Text style={[styles.streakText, { color: category.color }]}>
                      {habit.streak} day streak
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.ctaButton,
                    done
                      ? { backgroundColor: category.color, borderColor: category.color }
                      : { backgroundColor: Colors.white, borderColor: Colors.border },
                  ]}
                  onPress={() => toggleToday(habit.id)}
                >
                  <Text style={[styles.ctaText, { color: done ? Colors.white : category.color }]}>
                    {done ? 'Done today' : 'Mark done'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {habit.week.map((on, i) => (
                  <View key={i} style={styles.weekCell}>
                    <View
                      style={[
                        styles.weekBox,
                        { backgroundColor: on ? category.color : Colors.border },
                      ]}
                    >
                      {on && <IconSymbol name="checkmark" color={Colors.white} size={14} />}
                    </View>
                    <Text style={styles.weekLetter}>{DAY_LETTERS[i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Pressable style={styles.newHabitButton} onPress={openSheet}>
          <IconSymbol name="plus" color={Colors.primaryLight} size={18} />
          <Text style={styles.newHabitText}>New habit</Text>
        </Pressable>
      </View>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>New habit</Text>

          <TextInput
            value={habitName}
            onChangeText={setHabitName}
            placeholder="e.g. Read 20 pages"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.sheetEyebrow}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORY_ORDER.map((id) => {
              const c = TaskCategories[id];
              const on = habitCategory === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: on ? c.color : Colors.white, borderColor: on ? c.color : Colors.border },
                  ]}
                  onPress={() => setHabitCategory(id)}
                >
                  <Text style={[styles.categoryChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.createButton, !canSave && styles.createButtonDisabled]}
            disabled={!canSave}
            onPress={handleCreate}
          >
            <Text style={[styles.createButtonText, !canSave && styles.createButtonTextDisabled]}>Create habit</Text>
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
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  streakText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  ctaButton: {
    borderWidth: 1.5,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  ctaText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  weekBox: {
    width: '100%',
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLetter: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  newHabitButton: {
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
  newHabitText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primaryLight,
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
    marginTop: 18,
    marginBottom: 10,
  },
  input: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  createButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
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
