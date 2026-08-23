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
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate } from '@/utils/date';
import type { Exam } from '@/types/plan.types';

export default function Exams() {
  const { examPlan, updateExamPlan } = usePlan();
  const sheet = useEditableSheet<Exam>();

  // Soonest-upcoming first — matches the Dashboard's "My Exams" ordering.
  const exams = [...examPlan.exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime()
  );

  const handleAddOrSaveExam = async (exam: Exam) => {
    try {
      await updateExamPlan((exams) =>
        exams.some((e) => e.id === exam.id)
          ? exams.map((e) => (e.id === exam.id ? exam : e))
          : [...exams, exam]
      );
    } catch (err) {
      console.error('[Exams] failed to save exam', err);
      Alert.alert("Couldn't save exam", 'Check your connection and try again.');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await updateExamPlan((exams) => exams.filter((e) => e.id !== id));
    } catch (err) {
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
              onLongPress={() => sheet.setActionTarget(exam)}
              onMenuPress={() => sheet.setActionTarget(exam)}
            />
          ))
        )}

        <DashedAddButton label="Add exam" onPress={sheet.openNew} />
      </View>

      <AddExamModal
        visible={sheet.open}
        onClose={sheet.close}
        onAdd={handleAddOrSaveExam}
        editingExam={sheet.editing}
        hasExistingExams={examPlan.exams.length > 0}
      />

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && sheet.openEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && handleDeleteExam(sheet.actionTarget)}
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
