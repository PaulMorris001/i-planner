import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { weekdayIndexMonday } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import type { ClassItem, ClassFrequency } from '@/types/plan.types';

const CLASS_FREQ_OPTIONS: { key: ClassFrequency; label: string }[] = [
  { key: 'weekly',   label: 'Weekly' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'daily',    label: 'Every day' },
  { key: 'monthly',  label: 'Monthly' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function parseTimeToDate(time: string): Date {
  const minutes = parseTimeToMinutes(time);
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

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
  const [time, setTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const reset = () => {
    setClassName('');
    setStartDate(new Date());
    setRecurring(true);
    setFreq('weekly');
    setTime(null);
  };

  useEffect(() => {
    if (!visible) return;
    if (editingClass) {
      setClassName(editingClass.courseName);
      setStartDate(new Date(editingClass.startDate));
      setRecurring(editingClass.recurring);
      setFreq(editingClass.freq);
      setTime(editingClass.time ? parseTimeToDate(editingClass.time) : null);
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
    if (!className.trim()) return;
    const startWd = weekdayIndexMonday(startDate);
    let dayIdxs: number[] = [];
    if (recurring) {
      if (freq === 'weekly') dayIdxs = [startWd];
      else if (freq === 'weekdays') dayIdxs = [0, 1, 2, 3, 4];
      else if (freq === 'daily') dayIdxs = [0, 1, 2, 3, 4, 5, 6];
      // monthly: no weekly grid slot — shows in the class list only
    } else {
      dayIdxs = [startWd];
    }
    const item: ClassItem = {
      id:         editingClass?.id ?? Date.now().toString(),
      courseName: className.trim(),
      startDate:  startDate.toISOString(),
      recurring,
      freq,
      dayIdxs,
      time: time ? formatTime(time) : '9:00 AM',
    };
    onAdd(item);
    handleClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={88}>
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>{editingClass ? 'Edit class' : 'Add a class'}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <Text style={styles.datePickerText}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}

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
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, freq === f.key && { backgroundColor: '#6366F1', borderColor: '#6366F1' }]}
                  onPress={() => setFreq(f.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, freq === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.sheetEyebrow}>Start time</Text>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
            <Text style={styles.datePickerIcon}>🕐</Text>
            <Text style={[styles.datePickerText, !time && styles.datePickerPlaceholder]}>
              {time ? formatTime(time) : 'Select a time'}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowTimePicker(false);
                if (date) setTime(date);
              }}
            />
          )}

          <TouchableOpacity style={styles.sheetSaveBtn} onPress={handleAdd} activeOpacity={0.85}>
            <Text style={styles.sheetSaveBtnText}>{editingClass ? 'Save changes' : 'Add class'}</Text>
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
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: Colors.textSecondary },
  sheetEyebrow: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 9,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 13,
    padding: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14, height: 34, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  chipText:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

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
  sheetSaveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
