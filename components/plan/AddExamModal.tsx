import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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

interface AddExamModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (exam: Exam) => void;
  editingExam?: Exam | null;
}

export function AddExamModal({ visible, onClose, onAdd, editingExam }: AddExamModalProps) {
  const [examName, setExamName] = useState('');
  const [weeks, setWeeks] = useState(DEFAULT_EXAM_WEEKS);
  const [hours, setHours] = useState(DEFAULT_EXAM_HOURS);
  const [generating, setGenerating] = useState(false);

  const reset = () => {
    setExamName('');
    setWeeks(DEFAULT_EXAM_WEEKS);
    setHours(DEFAULT_EXAM_HOURS);
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

  const handleSave = async () => {
    const name = examName.trim() || EXAM_NAME_PLACEHOLDER;
    const examDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();

    // Editing an existing exam keeps its already-generated topics as-is — only
    // a brand-new exam needs a fresh topic breakdown.
    if (editingExam) {
      onAdd({ ...editingExam, name, subject: name, examDate, hoursPerWeek: hours, weeksRemaining: weeks });
      handleClose();
      return;
    }

    setGenerating(true);
    let topics: Exam['topics'];
    try {
      const suggestions = await planService.generateExamTopics({
        name, subject: name, hoursPerWeek: hours, weeksRemaining: weeks,
      });
      topics = suggestions.map((s, i) => ({ id: `${Date.now()}-${i}`, title: s.title, week: s.week, done: false }));
    } catch (err) {
      console.error('[AddExamModal] failed to generate exam topics', err);
    } finally {
      setGenerating(false);
    }

    onAdd({ id: Date.now().toString(), name, subject: name, examDate, hoursPerWeek: hours, weeksRemaining: weeks, topics });
    handleClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose}>
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

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85} disabled={generating}>
            <Text style={styles.saveBtnText}>
              {editingExam ? 'Save changes' : generating ? 'Generating your study plan…' : 'Generate my study plan'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
