import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Switch, ScrollView, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';
import { useTasks } from '@/hooks/useTasks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskCategoryId, TaskPriorities, TaskPriorityId } from '@/constants/taskMeta';

const CATEGORY_ORDER: TaskCategoryId[] = ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'];
const PRIORITY_ORDER: TaskPriorityId[] = ['high', 'medium', 'low'];
const DAY_LABELS = ['Mon', 'Today', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_DAY_INDEX = 1;

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NewTaskModal() {
  const { isOpen, close } = useNewTaskModal();
  const { createTask } = useTasks();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategoryId>('academic');
  const [priority, setPriority] = useState<TaskPriorityId>('medium');
  const [dayIndex, setDayIndex] = useState(DEFAULT_DAY_INDEX);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSave = title.trim().length > 0 && !submitting;

  const reset = () => {
    setTitle('');
    setCategory('academic');
    setPriority('medium');
    setDayIndex(DEFAULT_DAY_INDEX);
    setDueTime(null);
    setDueDate(null);
    setRecurring(false);
    setNotes('');
  };

  const handleClose = () => {
    close();
    reset();
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        category,
        priority,
        day: dayIndex,
        hour: dueTime ? dueTime.getHours() : 23,
        time: dueTime ? formatTime(dueTime) : '',
        dueDate: dueDate ? dueDate.toISOString() : '',
        recurring,
        notes: notes.trim(),
      });
      handleClose();
    } catch (err) {
      console.error('[NewTaskModal] failed to create task', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>New task</Text>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <IconSymbol name="xmark" color={Colors.textSecondary} size={17} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What do you need to do?"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.eyebrow}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORY_ORDER.map((id) => {
              const c = TaskCategories[id];
              const on = category === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.pillChip,
                    { backgroundColor: on ? c.color : Colors.white, borderColor: on ? c.color : Colors.border },
                  ]}
                  onPress={() => setCategory(id)}
                >
                  <Text style={[styles.pillChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.eyebrow}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITY_ORDER.map((id) => {
              const p = TaskPriorities[id];
              const on = priority === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.priorityChip,
                    { backgroundColor: on ? p.color : Colors.white, borderColor: on ? p.color : Colors.border },
                  ]}
                  onPress={() => setPriority(id)}
                >
                  <Text style={[styles.priorityChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.eyebrow}>Due day</Text>
          <View style={styles.chipWrap}>
            {DAY_LABELS.map((label, i) => {
              const on = dayIndex === i;
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.dayChip,
                    { backgroundColor: on ? Colors.primaryLight : Colors.white, borderColor: on ? Colors.primaryLight : Colors.border },
                  ]}
                  onPress={() => setDayIndex(i)}
                >
                  <Text style={[styles.dayChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldLabelRow}>
            <Text style={styles.eyebrow}>Due date</Text>
            {dueDate && (
              <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                <Text style={styles.clearLabel}>Clear</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
            <IconSymbol name="calendar" color={Colors.textSecondary} size={17} />
            <Text style={[styles.datePickerText, !dueDate && styles.datePickerPlaceholder]}>
              {dueDate ? formatDate(dueDate) : 'Select date (optional)'}
            </Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (date) setDueDate(date);
              }}
            />
          )}

          <View style={styles.fieldLabelRow}>
            <Text style={styles.eyebrow}>Due time</Text>
            {dueTime && (
              <Pressable onPress={() => setDueTime(null)} hitSlop={8}>
                <Text style={styles.clearLabel}>Clear</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={styles.datePickerButton} onPress={() => setShowTimePicker(true)}>
            <IconSymbol name="clock" color={Colors.textSecondary} size={17} />
            <Text style={[styles.datePickerText, !dueTime && styles.datePickerPlaceholder]}>
              {dueTime ? formatTime(dueTime) : 'Select time (optional)'}
            </Text>
          </Pressable>
          {showTimePicker && (
            <DateTimePicker
              value={dueTime ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowTimePicker(false);
                if (date) setDueTime(date);
              }}
            />
          )}

          <View style={styles.repeatRow}>
            <View>
              <Text style={styles.repeatTitle}>Repeat</Text>
              <Text style={styles.repeatSub}>Recurring task</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={Colors.white}
            />
          </View>

          <Text style={styles.eyebrow}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add details (optional)"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.notesInput]}
            multiline
          />

          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              disabled={!canSave}
              onPress={handleCreate}
            >
              <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>Create task</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '90%',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  notesInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    backgroundColor: Colors.white,
  },
  datePickerText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  datePickerPlaceholder: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  pillChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 11,
    paddingVertical: 10,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  dayChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 13,
    paddingHorizontal: 15,
    marginTop: 14,
  },
  repeatTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  repeatSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: 14,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  saveButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
