import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskCategoryId } from '@/constants/taskMeta';
import { useHabits } from '@/hooks/useHabits';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { confirmDelete } from '@/utils/confirmDelete';
import type { Habit, HabitFrequency } from '@/types/habit.types';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CATEGORY_ORDER: TaskCategoryId[] = ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'];

const FREQ_OPTIONS: { id: HabitFrequency; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const FREQ_LABEL: Record<HabitFrequency, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const STREAK_UNIT: Record<HabitFrequency, string> = {
  daily: 'day',
  weekdays: 'day',
  weekly: 'week',
  monthly: 'month',
};

function mondayOfCurrentWeek(): Date {
  const d = new Date();
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Habits() {
  const { habits, createHabit, toggleToday, updateHabit, deleteHabit } = useHabits();

  const sheet = useEditableSheet<Habit>();
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState<TaskCategoryId>('academic');
  const [habitFreq, setHabitFreq] = useState<HabitFrequency>('daily');
  const [submitting, setSubmitting] = useState(false);

  const doneToday = habits.filter((h) => h.doneToday).length;
  const canSave = habitName.trim().length > 0 && !submitting;
  const monday = mondayOfCurrentWeek();

  const openSheet = () => {
    setHabitName('');
    setHabitCategory('academic');
    setHabitFreq('daily');
    sheet.openNew();
  };

  const openSheetForEdit = (habit: Habit) => {
    setHabitName(habit.name);
    setHabitCategory(habit.category);
    setHabitFreq(habit.freq);
    sheet.openEdit(habit);
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (sheet.editing) {
        await updateHabit(sheet.editing.id, { name: habitName.trim(), category: habitCategory, freq: habitFreq });
      } else {
        await createHabit({ name: habitName.trim(), category: habitCategory, freq: habitFreq });
      }
      sheet.close();
    } catch (err) {
      console.error('[Habits] failed to save habit', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHabit = (habit: Habit) => {
    confirmDelete(habit.name, () => {
      deleteHabit(habit.id).catch((err) => {
        console.error('[Habits] failed to delete habit', err);
      });
    });
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Habits" subtitle={`${doneToday} of ${habits.length} done today`} />

      <View style={styles.topActionRow}>
        <DashedAddButton label="New habit" onPress={openSheet} />
      </View>

      <View style={styles.list}>
        {habits.map((habit) => {
          const category = TaskCategories[habit.category];
          const done = habit.doneToday;
          const createdDate = new Date(habit.createdAt);
          createdDate.setHours(0, 0, 0, 0);
          return (
            <Card
              key={habit.id}
              style={styles.card}
              onLongPress={() => sheet.setActionTarget(habit)}
            >
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <View style={styles.streakRow}>
                    <IconSymbol name="flame.fill" color={category.color} size={13} />
                    <Text style={[styles.streakText, { color: category.color }]}>
                      {habit.streak} {STREAK_UNIT[habit.freq]}{habit.streak === 1 ? '' : 's'} streak · {FREQ_LABEL[habit.freq]}
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
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => sheet.setActionTarget(habit)}
                >
                  <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {habit.week.map((doneThisDay, i) => {
                  const cellDate = new Date(monday);
                  cellDate.setDate(monday.getDate() + i);
                  const beforeCreation = cellDate < createdDate;
                  return (
                    <View key={i} style={styles.weekCell}>
                      <View
                        style={[
                          styles.weekBox,
                          beforeCreation
                            ? styles.weekBoxDisabled
                            : { backgroundColor: doneThisDay ? category.color : Colors.border },
                        ]}
                      >
                        {doneThisDay && !beforeCreation && (
                          <IconSymbol name="checkmark" color={Colors.white} size={14} />
                        )}
                      </View>
                      <Text style={styles.weekLetter}>{DAY_LETTERS[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </View>

      <BottomSheetModal visible={sheet.open} onClose={sheet.close}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{sheet.editing ? 'Edit habit' : 'New habit'}</Text>

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
              return (
                <Chip
                  key={id}
                  label={c.label}
                  selected={habitCategory === id}
                  onPress={() => setHabitCategory(id)}
                  activeColor={c.color}
                />
              );
            })}
          </View>

          <Text style={styles.sheetEyebrow}>Repeats</Text>
          <View style={styles.chipWrap}>
            {FREQ_OPTIONS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={habitFreq === f.id}
                onPress={() => setHabitFreq(f.id)}
                activeColor={Colors.primary}
              />
            ))}
          </View>

          <Pressable
            style={[styles.createButton, !canSave && styles.createButtonDisabled]}
            disabled={!canSave}
            onPress={handleCreate}
          >
            <Text style={[styles.createButtonText, !canSave && styles.createButtonTextDisabled]}>
              {sheet.editing ? 'Save changes' : 'Create habit'}
            </Text>
          </Pressable>
          </ScrollView>
      </BottomSheetModal>

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && openSheetForEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && handleDeleteHabit(sheet.actionTarget)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  topActionRow: {
    marginTop: 16,
    paddingHorizontal: Spacing.md,
  },
  list: {
    marginTop: 16,
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
  weekBoxDisabled: {
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  weekLetter: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
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
