import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UpgradeModal } from '@/components/ui/UpgradeModal';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { FEATURE_MIN_TIER, hasTier } from '@/constants/featureTiers';
import { usePurchases } from '@/contexts/PurchasesContext';
import { syllabusService } from '@/services/syllabus.service';
import { usePlan } from '@/hooks/usePlan';
import { useTasks } from '@/hooks/useTasks';
import { useSyllabi } from '@/hooks/useSyllabi';
import { weekdayIndexMonday, parseISODateLocal, formatDatePickerLabel } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

interface DraftDeadline {
  key: string;
  title: string;
  date: Date;
}

type Step = 'pick' | 'extracting' | 'review' | 'creating' | 'success';

interface SyllabusUploadModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SuccessSummary {
  courseName: string;
  savedCount: number;
  totalCount: number;
  failedCount: number;
}

// Shared between onboarding's student-plan.tsx and the post-signin Syllabi
// screens (syllabi.tsx, Dashboard's My Syllabi card).
export function SyllabusUploadModal({ visible, onClose }: SyllabusUploadModalProps) {
  const { updatePlan } = usePlan();
  const { createTask } = useTasks();
  const { syllabi, createSyllabus } = useSyllabi();
  const { tier } = usePurchases();

  const [step, setStep] = useState<Step>('pick');
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [fileName, setFileName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [deadlines, setDeadlines] = useState<DraftDeadline[]>([]);
  const [datePickerKey, setDatePickerKey] = useState<string | null>(null);
  // True when `deadlines` was seeded from the topic outline, not real dated
  // deadlines — swaps the review screen's copy so placeholder dates don't
  // look like something the AI actually found.
  const [showingTopicsFallback, setShowingTopicsFallback] = useState(false);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);

  const reset = () => {
    setStep('pick');
    setFileName('');
    setCourseName('');
    setDeadlines([]);
    setDatePickerKey(null);
    setShowingTopicsFallback(false);
    setSuccessSummary(null);
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

    if (syllabi.length > 0 && !hasTier(tier, FEATURE_MIN_TIER.syllabus_extraction)) {
      setUpgradeVisible(true);
      return;
    }

    setStep('extracting');
    try {
      const file = new File(asset.uri);
      const fileBase64 = await file.base64();
      const extraction = await syllabusService.extract({ fileBase64, filename: asset.name });
      // Parsed as local midnight, not `new Date(d.date)`'s UTC midnight, so
      // this round-trips to the same calendar day for users west of UTC.
      const extractedDeadlines = extraction.deadlines.map((d, i) => ({
        key: `ex-${i}`,
        title: d.title,
        date: parseISODateLocal(d.date),
      }));
      // No dated deadlines — fall back to the topic outline (rows start on
      // today; user picks real dates), or one blank row if even that's empty.
      const topicFallback = extraction.subtopics.map((title, i) => ({
        key: `topic-${i}`,
        title,
        date: new Date(),
      }));
      setFileName(asset.name);
      setCourseName(extraction.courseName);
      setShowingTopicsFallback(extractedDeadlines.length === 0 && topicFallback.length > 0);
      setDeadlines(
        extractedDeadlines.length > 0
          ? extractedDeadlines
          : topicFallback.length > 0
          ? topicFallback
          : [{ key: `custom-${Date.now()}`, title: '', date: new Date() }]
      );
      setStep('review');
    } catch (err) {
      console.error('[SyllabusUploadModal] extraction failed', err);
      // Defense in depth — covers `syllabi` being stale; the backend's
      // exemption check (syllabus.controller.ts) is the real source of truth.
      const field = (err as { field?: string } | null)?.field;
      if (field === 'tier') {
        setUpgradeVisible(true);
      } else {
        const message = (err as { message?: string })?.message ?? "Couldn't read that syllabus. Try again.";
        Alert.alert("Couldn't read syllabus", message);
      }
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
        // Syllabus gives deadlines, not a meeting schedule, so this is a
        // one-off record; edit later to add a real recurring schedule.
        recurring: false,
        freq: 'weekly',
        dayIdxs: [weekdayIndexMonday(new Date())],
        time: '',
      };
      await updatePlan((p) => ({ ...p, classes: [...p.classes, newClass] }));

      const validDeadlines = deadlines.filter((d) => d.title.trim().length > 0);
      const results = await Promise.allSettled(
        validDeadlines.map((d) =>
          createTask({
            title: d.title.trim(),
            category: 'academic',
            priority: 'medium',
            day: weekdayIndexMonday(d.date),
            // 23 matches NewTaskModal's "no time picked" convention, so these
            // sort after time-scheduled tasks within the same priority tier.
            hour: 23,
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

      setSuccessSummary({
        courseName: name,
        savedCount: validDeadlines.length - failed,
        totalCount: validDeadlines.length,
        failedCount: failed,
      });
      setStep('success');
    } catch (err) {
      console.error('[SyllabusUploadModal] failed to save syllabus', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
      setStep('review');
    }
  };

  return (
    <>
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
          <ScrollView style={styles.deadlineList} keyboardShouldPersistTaps="handled">
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

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              {showingTopicsFallback ? "Topics — set a date for each" : 'Deadlines'}
            </Text>
            {showingTopicsFallback && (
              <Text style={styles.topicsNote}>
                No dated deadlines found, so here's the course's topic outline instead — pick a date for
                each one you want tracked, or remove ones you don't.
              </Text>
            )}
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
                    <Text style={styles.deadlineDateText}>{formatDatePickerLabel(d.date)}</Text>
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

          <InlineDateTimePicker
            visible={!!datePickerKey}
            value={deadlines.find((d) => d.key === datePickerKey)?.date ?? new Date()}
            mode="date"
            onChange={(date) => datePickerKey && updateDeadline(datePickerKey, { date })}
            onDismiss={() => setDatePickerKey(null)}
          />

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

      {step === 'success' && successSummary && (
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <IconSymbol name="checkmark" color={Colors.success} size={26} />
          </View>
          <Text style={styles.successTitle}>Syllabus added</Text>
          <Text style={styles.successSub}>
            {successSummary.failedCount > 0
              ? `${successSummary.courseName} was added with ${successSummary.savedCount} of ${successSummary.totalCount} deadlines — ${successSummary.failedCount} failed to save, add those manually.`
              : `${successSummary.courseName} was added with ${successSummary.totalCount} deadline${successSummary.totalCount === 1 ? '' : 's'}.`}
          </Text>
          <Pressable style={styles.successButton} onPress={handleClose}>
            <Text style={styles.successButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
    </BottomSheetModal>
    <UpgradeModal
      visible={upgradeVisible}
      onClose={() => setUpgradeVisible(false)}
      requiredTier={FEATURE_MIN_TIER.syllabus_extraction}
      featureLabel="Syllabus AI extraction"
    />
    </>
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
  topicsNote: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 10,
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
    paddingVertical: 15,
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
  successBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  successSub: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  successButton: {
    marginTop: 22,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
