import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing } from '@/constants/theme';
import { planService } from '@/services/plan.service';
import {
  ExamSetupForm,
  EXAM_NAME_PLACEHOLDER,
  DEFAULT_EXAM_WEEKS,
  DEFAULT_EXAM_HOURS,
} from './ExamSetupForm';
import type { Exam } from '@/types/plan.types';

interface DraftTopic {
  key: string;
  title: string;
  week: number;
}

type Step = 'form' | 'generating' | 'review';

interface AddExamModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (exam: Exam) => void;
  editingExam?: Exam | null;
}

export function AddExamModal({ visible, onClose, onAdd, editingExam }: AddExamModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [examName, setExamName] = useState('');
  const [weeks, setWeeks] = useState(DEFAULT_EXAM_WEEKS);
  const [hours, setHours] = useState(DEFAULT_EXAM_HOURS);
  const [topics, setTopics] = useState<DraftTopic[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep('form');
    setExamName('');
    setWeeks(DEFAULT_EXAM_WEEKS);
    setHours(DEFAULT_EXAM_HOURS);
    setTopics([]);
    setSubmitting(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (editingExam) {
      setExamName(editingExam.name);
      setWeeks(editingExam.weeksRemaining);
      setHours(editingExam.hoursPerWeek);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingExam]);

  const handleClose = () => {
    onClose();
    reset();
  };

  // Editing an existing exam keeps its already-generated topics as-is — only a
  // brand-new exam needs a fresh topic breakdown to review.
  const handleSaveEdit = () => {
    if (!editingExam) return;
    const name = examName.trim() || EXAM_NAME_PLACEHOLDER;
    const examDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    onAdd({ ...editingExam, name, subject: name, examDate, hoursPerWeek: hours, weeksRemaining: weeks });
    handleClose();
  };

  const handleGenerate = async () => {
    const name = examName.trim() || EXAM_NAME_PLACEHOLDER;
    setStep('generating');
    try {
      const suggestions = await planService.generateExamTopics({
        name, subject: name, hoursPerWeek: hours, weeksRemaining: weeks,
      });
      setTopics(suggestions.map((s, i) => ({ key: `gen-${i}`, title: s.title, week: s.week })));
      setStep('review');
    } catch (err) {
      console.error('[AddExamModal] failed to generate exam topics', err);
      Alert.alert("Couldn't generate a study plan", 'Check your connection and try again.');
      setStep('form');
    }
  };

  const updateTopic = (key: string, title: string) => {
    setTopics((prev) => prev.map((t) => (t.key === key ? { ...t, title } : t)));
  };

  const removeTopic = (key: string) => {
    setTopics((prev) => prev.filter((t) => t.key !== key));
  };

  const addTopic = () => {
    const nextWeek = topics.length ? Math.max(...topics.map((t) => t.week)) + 1 : 1;
    setTopics((prev) => [...prev, { key: `custom-${Date.now()}`, title: '', week: nextWeek }]);
  };

  const handleCreate = () => {
    const name = examName.trim() || EXAM_NAME_PLACEHOLDER;
    const examDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    setSubmitting(true);
    try {
      onAdd({
        id: Date.now().toString(),
        name,
        subject: name,
        examDate,
        hoursPerWeek: hours,
        weeksRemaining: weeks,
        topics: topics
          .filter((t) => t.title.trim().length > 0)
          .map((t) => ({ id: t.key, title: t.title.trim(), week: t.week, done: false })),
      });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={85}>
        {step === 'form' && (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{editingExam ? 'Edit exam' : 'Set up your exam'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <ExamSetupForm
                examName={examName}
                onExamNameChange={setExamName}
                weeks={weeks}
                hours={hours}
                onWeeksChange={setWeeks}
                onHoursChange={setHours}
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={editingExam ? handleSaveEdit : handleGenerate}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>
                  {editingExam ? 'Save changes' : 'Generate my study plan'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {step === 'generating' && (
          <View style={styles.generatingBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.generatingText}>Generating your study plan…</Text>
          </View>
        )}

        {step === 'review' && (
          <>
            <Text style={styles.title}>Review your study plan</Text>
            <Text style={styles.reviewSub}>Edit, remove, or add topics before creating the exam.</Text>

            <ScrollView style={styles.topicList} keyboardShouldPersistTaps="handled">
              {topics.map((t) => (
                <View key={t.key} style={styles.topicRow}>
                  <View style={styles.weekBadge}>
                    <Text style={styles.weekBadgeText}>{t.week}</Text>
                  </View>
                  <TextInput
                    value={t.title}
                    onChangeText={(text) => updateTopic(t.key, text)}
                    placeholder="Topic"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.topicInput}
                  />
                  <Pressable onPress={() => removeTopic(t.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.addTopicButton} onPress={addTopic}>
                <Text style={styles.addTopicText}>+ Add topic</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.reviewFooter}>
              <Pressable style={styles.backButton} onPress={() => setStep('form')} disabled={submitting}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, styles.reviewCreateButton, submitting && styles.saveBtnDisabled]}
                disabled={submitting}
                onPress={handleCreate}
              >
                <Text style={styles.saveBtnText}>{submitting ? 'Creating…' : 'Create exam'}</Text>
              </Pressable>
            </View>
          </>
        )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, flex: 1, marginRight: 10 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: Colors.textSecondary },
  saveBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  generatingBox: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 14,
  },
  generatingText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  reviewSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  topicList: { marginTop: 14 },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 13, padding: 12, marginBottom: 10,
  },
  weekBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.offWhite,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  topicInput: {
    flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary, padding: 0,
  },
  removeText: { fontSize: 13, color: Colors.textMuted, padding: 4 },
  addTopicButton: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border,
    borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  addTopicText: { fontSize: 14, fontWeight: '700', color: Colors.primaryLight },
  reviewFooter: { flexDirection: 'row', gap: 10, marginTop: 6 },
  backButton: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  backButtonText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  reviewCreateButton: { flex: 1, marginTop: 0 },
});
