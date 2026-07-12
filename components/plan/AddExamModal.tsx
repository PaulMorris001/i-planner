import { useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
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
}

export function AddExamModal({ visible, onClose, onAdd }: AddExamModalProps) {
  const [examName, setExamName] = useState('');
  const [weeks, setWeeks] = useState(DEFAULT_EXAM_WEEKS);
  const [hours, setHours] = useState(DEFAULT_EXAM_HOURS);

  const reset = () => {
    setExamName('');
    setWeeks(DEFAULT_EXAM_WEEKS);
    setHours(DEFAULT_EXAM_HOURS);
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleSave = () => {
    const name = examName.trim() || EXAM_NAME_PLACEHOLDER;
    const examDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    const exam: Exam = {
      id: Date.now().toString(),
      name,
      subject: name,
      examDate,
      hoursPerWeek: hours,
      weeksRemaining: weeks,
    };
    onAdd(exam);
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Set up your exam</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ExamSetupForm
          examName={examName}
          onExamNameChange={setExamName}
          weeks={weeks}
          hours={hours}
          onWeeksChange={setWeeks}
          onHoursChange={setHours}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Generate my study plan</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(20,18,40,0.4)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.offWhite,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, paddingTop: 14, paddingBottom: 30,
  },
  handle: {
    width: 38, height: 4, borderRadius: 999,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
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
