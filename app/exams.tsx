import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { AddExamModal } from '@/components/plan/AddExamModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListRow } from '@/components/ui/ListRow';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Colors, Spacing } from '@/constants/theme';
import { usePlan } from '@/hooks/usePlan';
import { confirmDelete } from '@/utils/confirmDelete';
import type { Exam } from '@/types/plan.types';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Exams() {
  const { examPlan, saveExamPlan } = usePlan();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [actionSheetTarget, setActionSheetTarget] = useState<Exam | null>(null);

  // Soonest-upcoming first — matches the Dashboard's "My Exams" ordering.
  const exams = [...examPlan.exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime()
  );

  const handleAddOrSaveExam = async (exam: Exam) => {
    const isEdit = examPlan.exams.some((e) => e.id === exam.id);
    try {
      await saveExamPlan({
        exams: isEdit
          ? examPlan.exams.map((e) => (e.id === exam.id ? exam : e))
          : [...examPlan.exams, exam],
      });
    } catch (err) {
      console.error('[Exams] failed to save exam', err);
      Alert.alert("Couldn't save exam", 'Check your connection and try again.');
    }
  };

  const handleRemove = async (id: string) => {
    const prevExams = examPlan.exams;
    try {
      await saveExamPlan({ exams: examPlan.exams.filter((e) => e.id !== id) });
    } catch (err) {
      await saveExamPlan({ exams: prevExams });
      console.error('[Exams] failed to remove exam', err);
      Alert.alert("Couldn't remove exam", 'Check your connection and try again.');
    }
  };

  const handleDeleteExam = (exam: Exam) => {
    confirmDelete(exam.name, () => handleRemove(exam.id));
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Exams" subtitle={`${exams.length} exam${exams.length === 1 ? '' : 's'}`} />

      <View style={styles.list}>
        {exams.length === 0 ? (
          <Text style={styles.emptyText}>No exams added yet.</Text>
        ) : (
          exams.map((exam) => (
            <ListRow
              key={exam.id}
              leading={{ type: 'bar', color: '#8B3FD1' }}
              title={exam.name}
              meta={`${exam.weeksRemaining} week${exam.weeksRemaining > 1 ? 's' : ''} · ${exam.hoursPerWeek}h/week · ${formatShortDate(exam.examDate)}`}
              onLongPress={() => setActionSheetTarget(exam)}
              onMenuPress={() => setActionSheetTarget(exam)}
            />
          ))
        )}

        <DashedAddButton label="Add exam" onPress={() => setModalOpen(true)} />
      </View>

      <AddExamModal
        visible={modalOpen || !!editingExam}
        onClose={() => {
          setModalOpen(false);
          setEditingExam(null);
        }}
        onAdd={handleAddOrSaveExam}
        editingExam={editingExam}
      />

      <ItemActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        onEdit={() => actionSheetTarget && setEditingExam(actionSheetTarget)}
        onDelete={() => actionSheetTarget && handleDeleteExam(actionSheetTarget)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  list: {
    marginTop: 20,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
