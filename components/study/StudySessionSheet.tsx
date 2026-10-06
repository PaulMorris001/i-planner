import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { Colors, Spacing } from '@/constants/theme';
import { formatMinuteOfDay } from '@/utils/studyFormat';
import type { NewStudySessionInput, StudySession } from '@/types/study.types';

interface StudySessionSheetProps {
  visible: boolean;
  onClose: () => void;
  // The session being edited, or null for a new one.
  editing: StudySession | null;
  saving: boolean;
  onSave: (input: NewStudySessionInput) => void;
  onDelete: (session: StudySession) => void;
}

const DEFAULT_START = 17 * 60;
const DEFAULT_END = 18 * 60;

function minuteToDate(minute: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

// Create or edit a reusable study session. The schedule is optional: with one, the
// phone reminds on the chosen days at the start time and a started session stops
// itself at the end time; without one, the session is just a named timer to start
// whenever. Either way the hours only count once Start is tapped.
export function StudySessionSheet({ visible, onClose, editing, saving, onSave, onDelete }: StudySessionSheetProps) {
  const [name, setName] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [startMinute, setStartMinute] = useState(DEFAULT_START);
  const [endMinute, setEndMinute] = useState(DEFAULT_END);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [error, setError] = useState('');

  // Fresh values each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    const hasSchedule = !!editing && editing.startMinute !== null && editing.endMinute !== null;
    setScheduled(hasSchedule);
    setDays(editing?.days ?? []);
    setStartMinute(editing?.startMinute ?? DEFAULT_START);
    setEndMinute(editing?.endMinute ?? DEFAULT_END);
    setPicker(null);
    setError('');
  }, [visible, editing]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Give the study session a name.');
      return;
    }
    if (scheduled) {
      if (days.length === 0) {
        setError('Pick at least one day, or turn the schedule off.');
        return;
      }
      if (endMinute <= startMinute) {
        setError('The end time must be after the start time.');
        return;
      }
    }
    setError('');
    onSave({
      name: name.trim(),
      days: scheduled ? days : [],
      startMinute: scheduled ? startMinute : null,
      endMinute: scheduled ? endMinute : null,
    });
  };

  const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{editing ? 'Edit study session' : 'New study session'}</Text>
        <Text style={styles.hint}>Create it once and start it whenever you study. Hours only count when you tap Start.</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Maths revision"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          maxLength={80}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Remind me and stop automatically</Text>
            <Text style={styles.switchDesc}>Pick the days and the hours you usually study. Optional.</Text>
          </View>
          <Switch
            value={scheduled}
            onValueChange={setScheduled}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={Colors.white}
          />
        </View>

        {scheduled && (
          <>
            <Text style={styles.label}>DAYS</Text>
            <WeekdayPicker selected={days} onChange={setDays} activeColor={Colors.primaryLight} />

            <View style={styles.timeRow}>
              <Pressable style={styles.timeButton} onPress={() => setPicker(picker === 'start' ? null : 'start')}>
                <Text style={styles.timeCaption}>STARTS</Text>
                <Text style={styles.timeValue}>{formatMinuteOfDay(startMinute)}</Text>
              </Pressable>
              <Pressable style={styles.timeButton} onPress={() => setPicker(picker === 'end' ? null : 'end')}>
                <Text style={styles.timeCaption}>ENDS</Text>
                <Text style={styles.timeValue}>{formatMinuteOfDay(endMinute)}</Text>
              </Pressable>
            </View>
            <InlineDateTimePicker
              visible={picker !== null}
              value={minuteToDate(picker === 'end' ? endMinute : startMinute)}
              mode="time"
              onChange={(d) => (picker === 'end' ? setEndMinute(toMinutes(d)) : setStartMinute(toMinutes(d)))}
              onDismiss={() => setPicker(null)}
            />
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.footerRow}>
          <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>

        {editing && (
          <Pressable style={styles.deleteButton} onPress={() => onDelete(editing)} disabled={saving}>
            <Text style={styles.deleteText}>Delete this study session</Text>
          </Pressable>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: Spacing.md },
  hint: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, paddingHorizontal: Spacing.md, lineHeight: 19 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: Spacing.md,
  },
  input: {
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingHorizontal: Spacing.md },
  switchLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  switchDesc: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  timeRow: { flexDirection: 'row', gap: 10, marginTop: 14, paddingHorizontal: Spacing.md },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
  },
  timeCaption: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  timeValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  error: { color: Colors.error, fontSize: 13, marginTop: 12, paddingHorizontal: Spacing.md },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: Spacing.md },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  deleteButton: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  deleteText: { fontSize: 14.5, fontWeight: '700', color: Colors.error },
});
