import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { Chip } from '@/components/ui/Chip';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';
import { useTasks } from '@/hooks/useTasks';
import { calendarImportService } from '@/services/calendarImport.service';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskCategoryId, TaskPriorities, TaskPriorityId } from '@/constants/taskMeta';
import {
  weekdayIndexMonday,
  parseISODateLocal,
  formatDatePickerLabel,
  formatTimeLabel,
  parseTimeToDate,
  dayIdxsForFrequency,
} from '@/utils/date';
import type { TaskFrequency } from '@/types/task.types';

const CATEGORY_ORDER: TaskCategoryId[] = ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'];
const PRIORITY_ORDER: TaskPriorityId[] = ['high', 'medium', 'low'];
const TASK_FREQ_OPTIONS: { key: TaskFrequency; label: string }[] = [
  { key: 'weekly',   label: 'Weekly' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'daily',    label: 'Every day' },
];
// Falls back to Planner's fixed "today" column when no due date is picked.
const DEFAULT_DAY_INDEX = 1;

export function NewTaskModal() {
  const { isOpen, editingTask, draft, close } = useNewTaskModal();
  const { createTask, updateTask } = useTasks();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategoryId>('academic');
  const [priority, setPriority] = useState<TaskPriorityId>('medium');
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<TaskFrequency>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentWd = dueDate ? weekdayIndexMonday(dueDate) : DEFAULT_DAY_INDEX;
  const canSave =
    title.trim().length > 0 && !submitting && !(recurring && freq === 'weekly' && selectedDays.length === 0);

  const reset = () => {
    setTitle('');
    setCategory('academic');
    setPriority('medium');
    setDueTime(null);
    setDueDate(null);
    setRecurring(false);
    setFreq('weekly');
    setSelectedDays([]);
    setNotes('');
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setCategory(editingTask.category);
      setPriority(editingTask.priority);
      setDueTime(editingTask.time ? parseTimeToDate(editingTask.time) : null);
      setDueDate(editingTask.dueDate ? parseISODateLocal(editingTask.dueDate) : null);
      setRecurring(editingTask.recurring);
      setFreq(editingTask.freq ?? 'weekly');
      setSelectedDays(editingTask.freq === 'weekly' ? editingTask.dayIdxs ?? [] : []);
      setNotes(editingTask.notes);
    } else if (draft) {
      // Category/priority have no source on a draft (a converted calendar event) — left at defaults.
      reset();
      setTitle(draft.title);
      setDueTime(draft.time ? parseTimeToDate(draft.time) : null);
      setDueDate(draft.dueDate ? parseISODateLocal(draft.dueDate) : null);
      setNotes(draft.notes ?? '');
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingTask, draft]);

  const handleClose = () => {
    close();
    reset();
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      const dayIdxs = recurring
        ? freq === 'weekly'
          ? (selectedDays.length ? selectedDays : [currentWd])
          : dayIdxsForFrequency(freq, currentWd)
        : undefined;
      const patch = {
        title: title.trim(),
        category,
        priority,
        day: currentWd,
        hour: dueTime ? dueTime.getHours() : 23,
        time: dueTime ? formatTimeLabel(dueTime) : '',
        dueDate: dueDate ? dueDate.toISOString() : '',
        recurring,
        freq: recurring ? freq : undefined,
        dayIdxs,
        notes: notes.trim(),
        // Points this task at the same calendar event the draft came from rather than creating a
        // new one. calendarLinkExternal marks it permanently so future edits/deletes never touch
        // that event (see TasksContext.updateTask/removeTask).
        ...(draft?.appleEventIds ? { appleEventIds: draft.appleEventIds } : {}),
        ...(draft?.googleEventId ? { googleEventId: draft.googleEventId } : {}),
        ...(draft?.draftSourceId ? { calendarLinkExternal: true } : {}),
      };
      if (editingTask) {
        await updateTask(editingTask.id, patch);
      } else {
        await createTask(patch);
        if (draft?.draftSourceId) {
          // Best-effort — if this fails, the import review screen just shows the event again next
          // visit, harmless since converting twice would just point another task at the same id.
          calendarImportService.remove(draft.draftSourceId).catch((err) => {
            console.error('[NewTaskModal] failed to clean up converted imported event', err);
          });
        }
      }
      handleClose();
    } catch (err) {
      console.error('[NewTaskModal] failed to save task', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={isOpen} onClose={handleClose}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Text style={styles.title}>{editingTask ? 'Edit task' : 'New task'}</Text>
            <ModalCloseButton onPress={handleClose} variant="icon" />
          </View>

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
              return (
                <Chip
                  key={id}
                  label={c.label}
                  selected={category === id}
                  onPress={() => setCategory(id)}
                  activeColor={c.color}
                />
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
              {dueDate ? formatDatePickerLabel(dueDate) : 'Select date (optional)'}
            </Text>
          </Pressable>
          <InlineDateTimePicker
            visible={showDatePicker}
            value={dueDate ?? new Date()}
            mode="date"
            onChange={setDueDate}
            onDismiss={() => setShowDatePicker(false)}
          />

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
              {dueTime ? formatTimeLabel(dueTime) : 'Select time (optional)'}
            </Text>
          </Pressable>
          <InlineDateTimePicker
            visible={showTimePicker}
            value={dueTime ?? new Date()}
            mode="time"
            onChange={setDueTime}
            onDismiss={() => setShowTimePicker(false)}
          />

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

          {recurring && (
            <View style={styles.freqChipRow}>
              {TASK_FREQ_OPTIONS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  selected={freq === f.key}
                  onPress={() => {
                    setFreq(f.key);
                    if (f.key === 'weekly') {
                      setSelectedDays(prev => (prev.length ? prev : [currentWd]));
                    }
                  }}
                  activeColor={Colors.primaryLight}
                  size="compact"
                />
              ))}
            </View>
          )}

          {recurring && freq === 'weekly' && (
            <>
              <WeekdayPicker selected={selectedDays} onChange={setSelectedDays} activeColor={Colors.primaryLight} />
              {selectedDays.length === 0 && (
                <Text style={styles.weekdayHint}>Select at least one day</Text>
              )}
            </>
          )}

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
              <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                {editingTask ? 'Save changes' : 'Create task'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
  freqChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  weekdayHint: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
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
