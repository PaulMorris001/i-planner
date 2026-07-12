import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AddExamModal } from '@/components/plan/AddExamModal';
import { Colors, Spacing } from '@/constants/theme';
import { usePlan } from '@/hooks/usePlan';
import type { Exam } from '@/types/plan.types';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Exams() {
  const router = useRouter();
  const { examPlan, saveExamPlan } = usePlan();
  const [modalOpen, setModalOpen] = useState(false);

  // Soonest-upcoming first — matches the Dashboard's "My Exams" ordering.
  const exams = [...examPlan.exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime()
  );

  const handleAddExam = async (exam: Exam) => {
    try {
      await saveExamPlan({ exams: [...examPlan.exams, exam] });
    } catch (err) {
      console.error('[Exams] failed to add exam', err);
      Alert.alert("Couldn't add exam", 'Check your connection and try again.');
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

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Exams</Text>
      <Text style={styles.subtitle}>
        {exams.length} exam{exams.length === 1 ? '' : 's'}
      </Text>

      <View style={styles.list}>
        {exams.length === 0 ? (
          <Text style={styles.emptyText}>No exams added yet.</Text>
        ) : (
          exams.map((exam) => (
            <View key={exam.id} style={styles.examRow}>
              <View style={styles.examBar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.examRowTitle} numberOfLines={1}>{exam.name}</Text>
                <Text style={styles.examRowMeta}>
                  {exam.weeksRemaining} week{exam.weeksRemaining > 1 ? 's' : ''} · {exam.hoursPerWeek}h/week ·{' '}
                  {formatShortDate(exam.examDate)}
                </Text>
              </View>
              <Pressable onPress={() => handleRemove(exam.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable style={styles.addButton} onPress={() => setModalOpen(true)}>
          <IconSymbol name="plus" color={Colors.primaryLight} size={18} />
          <Text style={styles.addButtonText}>Add exam</Text>
        </Pressable>
      </View>

      <AddExamModal visible={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAddExam} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
    paddingHorizontal: Spacing.md,
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
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  examBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: '#8B3FD1',
  },
  examRowTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  examRowMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  removeText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  addButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
