import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { weekdayIndexMonday, dayIdxsForFrequency, formatDatePickerLabel, formatTimeLabel, localMidnight } from '@/utils/date';
import type { ClassFrequency, ClassItem } from '@/types/plan.types';

const CLASS_FREQ_OPTIONS: { key: ClassFrequency; label: string }[] = [
  { key: 'weekly',   label: 'Weekly' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'daily',    label: 'Every day' },
  { key: 'monthly',  label: 'Monthly' },
];

// Every field a ClassItem needs, in the shape both AddClassModal (single
// class) and TimetableUploadModal (one per reviewed row) already hold as
// local state — this is a direct, controlled mapping of that state, not a
// new model.
export interface ClassFieldsValue {
  className: string;
  startDate: Date;
  // Only meaningful when recurring is true — see ClassItem.endDate. Optional
  // (unlike startDate/time): null means "recurs indefinitely," the original
  // and still default behavior for a manually-added class.
  endDate: Date | null;
  recurring: boolean;
  freq: ClassFrequency;
  selectedDays: number[];
  time: Date | null;
  professor: string;
  venue: string;
  alarmEnabled: boolean;
}

// A blank starting point — used by AddClassModal's own reset() and by
// TimetableUploadModal's "+ Add class" (a manually-added row needs the same
// starting shape a brand-new single class does). A function, not a static
// object, since startDate must be "now" at the moment it's actually used,
// not frozen at module-load time.
export function defaultClassFields(): ClassFieldsValue {
  return {
    className: '',
    startDate: new Date(),
    endDate: null,
    recurring: true,
    freq: 'weekly',
    selectedDays: [],
    time: null,
    professor: '',
    venue: '',
    alarmEnabled: false,
  };
}

// The exact validity rule both call sites need: AddClassModal's Save button
// and TimetableUploadModal's per-row error state + its bulk-confirm filter.
// One definition so a future change to what "valid" means (like this
// session's own start-time-required addition) only has to happen once.
export function isClassFieldsValid(v: ClassFieldsValue): boolean {
  return (
    v.className.trim().length > 0 &&
    !!v.time &&
    !(v.recurring && v.freq === 'weekly' && v.selectedDays.length === 0) &&
    !(v.recurring && !!v.endDate && localMidnight(v.endDate) < localMidnight(v.startDate))
  );
}

// Turns an edited ClassFieldsValue into a real ClassItem — shared by
// AddClassModal (one item, id reused from editingClass or freshly minted)
// and TimetableUploadModal (N items at once, ids assigned by the caller to
// stay collision-free within one batch — see that file for why plain
// `Date.now().toString()` isn't safe there). Caller must already have
// checked isClassFieldsValid; this doesn't re-validate.
export function buildClassItem(fields: ClassFieldsValue, id: string): ClassItem {
  const { className, startDate, endDate, recurring, freq, selectedDays, time, professor, venue, alarmEnabled } = fields;
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
  return {
    id,
    courseName: className.trim(),
    startDate: startDate.toISOString(),
    // Only a recurring class has a meaningful "ends on" — a one-time class's
    // single occurrence IS its startDate, and isClassFieldsValid never blocks
    // save over endDate for a non-recurring one, so this must not silently
    // carry a stale value over from before recurring was toggled off.
    endDate: recurring && endDate ? endDate.toISOString() : undefined,
    recurring,
    freq,
    dayIdxs,
    time: time ? formatTimeLabel(time) : '9:00 AM',
    professor: professor.trim() || undefined,
    venue: venue.trim() || undefined,
    // Guards against the toggle having been on for a time that's since been
    // cleared — matches NewTaskModal's identical dueDate/dueTime guard. A
    // silently-defaulted '9:00 AM' above should never become a loud,
    // DND-bypassing alarm the user never actually chose that time for.
    alarmEnabled: time ? alarmEnabled : false,
  };
}

interface ClassFieldsEditorProps {
  value: ClassFieldsValue;
  onChange: (patch: Partial<ClassFieldsValue>) => void;
  datePickerVisible: boolean;
  onOpenDatePicker: () => void;
  onCloseDatePicker: () => void;
  endDatePickerVisible: boolean;
  onOpenEndDatePicker: () => void;
  onCloseEndDatePicker: () => void;
  timePickerVisible: boolean;
  onOpenTimePicker: () => void;
  onCloseTimePicker: () => void;
}

// Fully controlled — no internal state — so both AddClassModal (one instance,
// backed by its own useStates) and TimetableUploadModal (one instance per
// draft row, backed by an array of plain objects) can drive it identically.
export function ClassFieldsEditor({
  value, onChange,
  datePickerVisible, onOpenDatePicker, onCloseDatePicker,
  endDatePickerVisible, onOpenEndDatePicker, onCloseEndDatePicker,
  timePickerVisible, onOpenTimePicker, onCloseTimePicker,
}: ClassFieldsEditorProps) {
  const { className, startDate, endDate, recurring, freq, selectedDays, time, professor, venue, alarmEnabled } = value;
  const endDateBeforeStart = recurring && !!endDate && localMidnight(endDate) < localMidnight(startDate);

  return (
    <>
      <TextInput
        style={styles.input}
        placeholder="Class name (e.g. Corporate Finance)"
        placeholderTextColor={Colors.textMuted}
        value={className}
        onChangeText={(text) => onChange({ className: text })}
      />

      <Text style={styles.sheetEyebrow}>Starts on</Text>
      <TouchableOpacity style={styles.datePicker} onPress={onOpenDatePicker} activeOpacity={0.8}>
        <Text style={styles.datePickerIcon}>📅</Text>
        <Text style={styles.datePickerText}>{formatDatePickerLabel(startDate)}</Text>
      </TouchableOpacity>
      <InlineDateTimePicker
        visible={datePickerVisible}
        value={startDate}
        mode="date"
        onChange={(date) => onChange({ startDate: date })}
        onDismiss={onCloseDatePicker}
      />

      <View style={styles.recurringRow}>
        <View>
          <Text style={styles.recurringTitle}>Recurring</Text>
          <Text style={styles.recurringSub}>This class repeats</Text>
        </View>
        <TouchableOpacity onPress={() => onChange({ recurring: !recurring })} activeOpacity={0.8}>
          <View style={[styles.toggle, recurring && styles.toggleActive]}>
            <View style={[styles.toggleThumb, recurring && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {recurring && (
        <View style={styles.chipRow}>
          {CLASS_FREQ_OPTIONS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={freq === f.key}
              onPress={() => {
                const patch: Partial<ClassFieldsValue> = { freq: f.key };
                if (f.key === 'weekly' && selectedDays.length === 0) {
                  patch.selectedDays = [weekdayIndexMonday(startDate)];
                }
                onChange(patch);
              }}
              activeColor="#6366F1"
              size="compact"
            />
          ))}
        </View>
      )}

      {recurring && freq === 'weekly' && (
        <>
          <WeekdayPicker selected={selectedDays} onChange={(days) => onChange({ selectedDays: days })} activeColor="#6366F1" />
          {selectedDays.length === 0 && <Text style={styles.weekdayHint}>Select at least one day</Text>}
        </>
      )}

      {recurring && (
        <>
          <Text style={styles.sheetEyebrow}>Ends on (optional)</Text>
          <TouchableOpacity
            style={[styles.datePicker, endDateBeforeStart && styles.datePickerError]}
            onPress={onOpenEndDatePicker}
            activeOpacity={0.8}
          >
            <Text style={styles.datePickerIcon}>🏁</Text>
            <Text style={[styles.datePickerText, !endDate && styles.datePickerPlaceholder]}>
              {endDate ? formatDatePickerLabel(endDate) : 'No end date — repeats indefinitely'}
            </Text>
          </TouchableOpacity>
          {endDateBeforeStart && <Text style={styles.fieldError}>End date must be on or after the start date</Text>}
          {!!endDate && !endDateBeforeStart && (
            <Pressable onPress={() => onChange({ endDate: null })} hitSlop={8}>
              <Text style={styles.clearEndDateText}>Clear end date</Text>
            </Pressable>
          )}
          <InlineDateTimePicker
            visible={endDatePickerVisible}
            value={endDate ?? startDate}
            mode="date"
            onChange={(date) => onChange({ endDate: date })}
            onDismiss={onCloseEndDatePicker}
          />
        </>
      )}

      <Text style={styles.sheetEyebrow}>Start time</Text>
      <TouchableOpacity
        style={[styles.datePicker, !time && styles.datePickerError]}
        onPress={onOpenTimePicker}
        activeOpacity={0.8}
      >
        <Text style={styles.datePickerIcon}>🕐</Text>
        <Text style={[styles.datePickerText, !time && styles.datePickerPlaceholder]}>
          {time ? formatTimeLabel(time) : 'Select a time'}
        </Text>
      </TouchableOpacity>
      {!time && <Text style={styles.fieldError}>Start time is required</Text>}
      <InlineDateTimePicker
        visible={timePickerVisible}
        value={time ?? new Date()}
        mode="time"
        onChange={(t) => onChange({ time: t })}
        onDismiss={onCloseTimePicker}
      />

      {!!time && (
        <View style={styles.recurringRow}>
          <View>
            <Text style={styles.recurringTitle}>Alarm</Text>
            <Text style={styles.recurringSub}>Ring loudly at the start time</Text>
          </View>
          <TouchableOpacity onPress={() => onChange({ alarmEnabled: !alarmEnabled })} activeOpacity={0.8}>
            <View style={[styles.toggle, alarmEnabled && styles.toggleActive]}>
              <View style={[styles.toggleThumb, alarmEnabled && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sheetEyebrow}>Professor / lecturer</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Bro Code"
        placeholderTextColor={Colors.textMuted}
        value={professor}
        onChangeText={(text) => onChange({ professor: text })}
      />

      <Text style={styles.sheetEyebrow}>Venue</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Room 204, Business Building"
        placeholderTextColor={Colors.textMuted}
        value={venue}
        onChangeText={(text) => onChange({ venue: text })}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  datePickerError: { borderColor: Colors.error },
  fieldError: { fontSize: 12, color: Colors.error, marginTop: 6 },
  clearEndDateText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 6 },

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
  weekdayHint: { fontSize: 12, color: Colors.error, marginTop: 8 },
});
