import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { Chip } from '@/components/ui/Chip';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import {
  weekdayIndexMonday,
  parseISODateLocal,
  formatDatePickerLabel,
  formatTimeLabel,
  parseTimeToDate,
  dayIdxsForFrequency,
} from '@/utils/date';
import type { ClassItem, ClassFrequency } from '@/types/plan.types';

const CLASS_FREQ_OPTIONS: { key: ClassFrequency; label: string }[] = [
  { key: 'weekly',   label: 'Weekly' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'daily',    label: 'Every day' },
  { key: 'monthly',  label: 'Monthly' },
];

interface AddClassModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: ClassItem) => void;
  editingClass?: ClassItem | null;
}

export function AddClassModal({ visible, onClose, onAdd, editingClass }: AddClassModalProps) {
  const [className, setClassName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState(true);
  const [freq, setFreq] = useState<ClassFrequency>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [time, setTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [professor, setProfessor] = useState('');
  const [venue, setVenue] = useState('');

  const canSave = className.trim().length > 0 && !(recurring && freq === 'weekly' && selectedDays.length === 0);

  const reset = () => {
    setClassName('');
    setStartDate(new Date());
    setRecurring(true);
    setFreq('weekly');
    setSelectedDays([]);
    setTime(null);
    setProfessor('');
    setVenue('');
  };

  useEffect(() => {
    if (!visible) return;
    if (editingClass) {
      setClassName(editingClass.courseName);
      setStartDate(parseISODateLocal(editingClass.startDate));
      setRecurring(editingClass.recurring);
      setFreq(editingClass.freq);
      setSelectedDays(editingClass.freq === 'weekly' ? editingClass.dayIdxs : []);
      setTime(editingClass.time ? parseTimeToDate(editingClass.time) : null);
      setProfessor(editingClass.professor ?? '');
      setVenue(editingClass.venue ?? '');
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingClass]);

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleAdd = () => {
    if (!canSave) return;
    const startWd = weekdayIndexMonday(startDate);
    // monthly: no weekly grid slot — shows in the class list only, dayIdxs stays empty.
    // weekly: user-picked days (falls back to the start date's weekday if none picked).
    const dayIdxs = !recurring
      ? [startWd]
      : freq === 'monthly'
      ? []
      : freq === 'weekly'
      ? (selectedDays.length ? selectedDays : [startWd])
      : dayIdxsForFrequency(freq, startWd);
    const item: ClassItem = {
      id:         editingClass?.id ?? Date.now().toString(),
      courseName: className.trim(),
      startDate:  startDate.toISOString(),
      recurring,
      freq,
      dayIdxs,
      time: time ? formatTimeLabel(time) : '9:00 AM',
      professor: professor.trim() || undefined,
      venue: venue.trim() || undefined,
    };
    onAdd(item);
    handleClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={88}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{editingClass ? 'Edit class' : 'Add a class'}</Text>
            <ModalCloseButton onPress={handleClose} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Class name (e.g. Corporate Finance)"
            placeholderTextColor={Colors.textMuted}
            value={className}
            onChangeText={setClassName}
          />

          <Text style={styles.sheetEyebrow}>Starts on</Text>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
            <Text style={styles.datePickerIcon}>📅</Text>
            <Text style={styles.datePickerText}>{formatDatePickerLabel(startDate)}</Text>
          </TouchableOpacity>
          <InlineDateTimePicker
            visible={showDatePicker}
            value={startDate}
            mode="date"
            onChange={setStartDate}
            onDismiss={() => setShowDatePicker(false)}
          />

          <View style={styles.recurringRow}>
            <View>
              <Text style={styles.recurringTitle}>Recurring</Text>
              <Text style={styles.recurringSub}>This class repeats</Text>
            </View>
            <TouchableOpacity onPress={() => setRecurring(p => !p)} activeOpacity={0.8}>
              <View style={[styles.toggle, recurring && styles.toggleActive]}>
                <View style={[styles.toggleThumb, recurring && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>

          {recurring && (
            <View style={styles.chipRow}>
              {CLASS_FREQ_OPTIONS.map(f => (
                <Chip
                  key={f.key}
                  label={f.label}
                  selected={freq === f.key}
                  onPress={() => {
                    setFreq(f.key);
                    if (f.key === 'weekly') {
                      setSelectedDays(prev => (prev.length ? prev : [weekdayIndexMonday(startDate)]));
                    }
                  }}
                  activeColor="#6366F1"
                  size="compact"
                />
              ))}
            </View>
          )}

          {recurring && freq === 'weekly' && (
            <>
              <WeekdayPicker selected={selectedDays} onChange={setSelectedDays} activeColor="#6366F1" />
              {selectedDays.length === 0 && (
                <Text style={styles.weekdayHint}>Select at least one day</Text>
              )}
            </>
          )}

          <Text style={styles.sheetEyebrow}>Start time</Text>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
            <Text style={styles.datePickerIcon}>🕐</Text>
            <Text style={[styles.datePickerText, !time && styles.datePickerPlaceholder]}>
              {time ? formatTimeLabel(time) : 'Select a time'}
            </Text>
          </TouchableOpacity>
          <InlineDateTimePicker
            visible={showTimePicker}
            value={time ?? new Date()}
            mode="time"
            onChange={setTime}
            onDismiss={() => setShowTimePicker(false)}
          />

          <Text style={styles.sheetEyebrow}>Professor / lecturer</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dr. Adaeze Obi"
            placeholderTextColor={Colors.textMuted}
            value={professor}
            onChangeText={setProfessor}
          />

          <Text style={styles.sheetEyebrow}>Venue</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Room 204, Business Building"
            placeholderTextColor={Colors.textMuted}
            value={venue}
            onChangeText={setVenue}
          />

          <TouchableOpacity
            style={[styles.sheetSaveBtn, !canSave && styles.sheetSaveBtnDisabled]}
            onPress={handleAdd}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={[styles.sheetSaveBtnText, !canSave && styles.sheetSaveBtnTextDisabled]}>
              {editingClass ? 'Save changes' : 'Add class'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, flex: 1, marginRight: 10 },
  sheetEyebrow: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 9,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 13,
    padding: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },

  datePicker: {
    height: 48, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.primary, backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: Spacing.sm,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '600' },
  datePickerPlaceholder: { color: Colors.textMuted, fontWeight: '400' },

  recurringRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 13, padding: 13, paddingHorizontal: 15, marginTop: 16,
  },
  recurringTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  recurringSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  toggle:            { width: 40, height: 22, borderRadius: 11, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive:      { backgroundColor: Colors.primary },
  toggleThumb:       { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white },
  toggleThumbActive: { transform: [{ translateX: 18 }] },

  sheetSaveBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  sheetSaveBtnDisabled: { backgroundColor: Colors.border },
  sheetSaveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  sheetSaveBtnTextDisabled: { color: Colors.textMuted },
  weekdayHint: { fontSize: 12, color: Colors.error, marginTop: 8 },
});
