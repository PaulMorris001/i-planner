import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { syllabusService } from '@/services/syllabus.service';
import { usePlan } from '@/hooks/usePlan';
import { useTasks } from '@/hooks/useTasks';
import { useSyllabi } from '@/hooks/useSyllabi';
import { weekdayIndexMonday } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

interface DraftDeadline {
  key: string;
  title: string;
  date: Date;
}

type Step = 'pick' | 'extracting' | 'review' | 'creating';

interface SyllabusUploadModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Shared between onboarding's student-plan.tsx and the post-signin Syllabi
// screens (syllabi.tsx, Dashboard's My Syllabi card) — works in both since
// TasksProvider now lives at the root layout rather than just the (app) group.
export function SyllabusUploadModal({ visible, onClose }: SyllabusUploadModalProps) {
  const { plan, savePlan } = usePlan();
  const { createTask } = useTasks();
  const { createSyllabus } = useSyllabi();

  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [deadlines, setDeadlines] = useState<DraftDeadline[]>([]);
  const [datePickerKey, setDatePickerKey] = useState<string | null>(null);

  const reset = () => {
    setStep('pick');
    setFileName('');
    setCourseName('');
    setDeadlines([]);
    setDatePickerKey(null);
  };

  useEffect(() => {
    if (visible) reset();
  }, [visible]);

  const handleClose = () => {
    if (step === 'extracting' || step === 'creating') return;
    onClose();
    reset();
  };

  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setStep('extracting');
    try {
      const file = new File(asset.uri);
      const fileBase64 = await file.base64();
      const extraction = await syllabusService.extract({ fileBase64, filename: asset.name });
      setFileName(asset.name);
      setCourseName(extraction.courseName);
      setDeadlines(
        extraction.deadlines.map((d, i) => ({ key: `ex-${i}`, title: d.title, date: new Date(d.date) }))
      );
      setStep('review');
    } catch (err) {
      console.error('[SyllabusUploadModal] extraction failed', err);
      const message = (err as { message?: string })?.message ?? "Couldn't read that syllabus. Try again.";
      Alert.alert("Couldn't read syllabus", message);
      setStep('pick');
    }
  };

  const updateDeadline = (key: string, patch: Partial<DraftDeadline>) => {
    setDeadlines((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDeadline = (key: string) => {
    setDeadlines((prev) => prev.filter((d) => d.key !== key));
  };

  const addDeadline = () => {
    setDeadlines((prev) => [...prev, { key: `custom-${Date.now()}`, title: '', date: new Date() }]);
  };

  const handleConfirm = async () => {
    const name = courseName.trim() || 'Untitled course';
    setStep('creating');
    try {
      const newClass: ClassItem = {
        id: Date.now().toString(),
        courseName: name,
        startDate: new Date().toISOString(),
        // The syllabus gives us deadlines, not a weekly meeting schedule — this
        // class is created as a one-off record (edit it later to add a real
        // recurring schedule) rather than guessing days/times it doesn't state.
        recurring: false,
        freq: 'weekly',
        dayIdxs: [weekdayIndexMonday(new Date())],
        time: '',
      };
      await savePlan({ ...plan, classes: [...plan.classes, newClass] });

      const validDeadlines = deadlines.filter((d) => d.title.trim().length > 0);
      const results = await Promise.allSettled(
        validDeadlines.map((d) =>
          createTask({
            title: d.title.trim(),
            category: 'academic',
            priority: 'medium',
            day: weekdayIndexMonday(d.date),
            hour: 9,
            time: '',
            dueDate: d.date.toISOString(),
            recurring: false,
            notes: `From syllabus: ${name}`,
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected').length;

      await createSyllabus({ fileName, courseName: name, classId: newClass.id }).catch((err) => {
        console.error('[SyllabusUploadModal] failed to record syllabus metadata', err);
      });

      onClose();
      reset();
      Alert.alert(
        'Syllabus added',
        failed > 0
          ? `${name} was added with ${validDeadlines.length - failed} of ${validDeadlines.length} deadlines — ${failed} failed to save, add those manually.`
          : `${name} was added with ${validDeadlines.length} deadline${validDeadlines.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      console.error('[SyllabusUploadModal] failed to save syllabus', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
      setStep('review');
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={85}>
      {step === 'pick' && (
        <>
          <Text style={styles.title}>Upload syllabus</Text>
          <Text style={styles.sub}>
            Upload a PDF syllabus and AI will pull out the course name and every deadline.
          </Text>
          <Pressable style={styles.pickButton} onPress={handlePick}>
            <Text style={styles.pickButtonText}>Choose PDF</Text>
          </Pressable>
        </>
      )}

      {step === 'extracting' && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.centerText}>Reading your syllabus…</Text>
        </View>
      )}

      {(step === 'review' || step === 'creating') && (
        <>
          <Text style={styles.title}>Review</Text>
          <Text style={styles.sub}>Edit anything the AI got wrong before adding it to your planner.</Text>

          <Text style={styles.fieldLabel}>Course name</Text>
          <TextInput
            value={courseName}
            onChangeText={setCourseName}
            placeholder="Course name"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Deadlines</Text>
          <ScrollView style={styles.deadlineList} keyboardShouldPersistTaps="handled">
            {deadlines.map((d) => (
              <View key={d.key} style={styles.deadlineRow}>
                <View style={styles.deadlineInputs}>
                  <TextInput
                    value={d.title}
                    onChangeText={(text) => updateDeadline(d.key, { title: text })}
                    placeholder="Deadline"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.deadlineTitleInput}
                  />
                  <Pressable onPress={() => setDatePickerKey(d.key)}>
                    <Text style={styles.deadlineDateText}>{formatDate(d.date)}</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => removeDeadline(d.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {deadlines.length === 0 && (
              <Text style={styles.emptyText}>No deadlines detected — add one manually below.</Text>
            )}

            <Pressable style={styles.addDeadlineButton} onPress={addDeadline}>
              <Text style={styles.addDeadlineText}>+ Add deadline</Text>
            </Pressable>
          </ScrollView>

          {datePickerKey && (
            <DateTimePicker
              value={deadlines.find((d) => d.key === datePickerKey)?.date ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setDatePickerKey(null);
                if (date && datePickerKey) updateDeadline(datePickerKey, { date });
              }}
            />
          )}

          <View style={styles.footerRow}>
            <Pressable style={styles.backButton} onPress={handleClose} disabled={step === 'creating'}>
              <Text style={styles.backButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, step === 'creating' && styles.confirmButtonDisabled]}
              disabled={step === 'creating'}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>{step === 'creating' ? 'Adding…' : 'Add to planner'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  pickButton: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  centerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  deadlineList: {
    marginTop: 4,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
  },
  deadlineInputs: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  deadlineTitleInput: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
  },
  deadlineDateText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  removeText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  addDeadlineButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addDeadlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
