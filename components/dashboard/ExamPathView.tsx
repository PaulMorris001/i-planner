import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ExamCarousel } from '@/components/plan/ExamCarousel';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionCardHeader } from '@/components/ui/SectionCardHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ViewAllRow } from '@/components/ui/ViewAllRow';
import { SavingsGoalCard } from '@/components/dashboard/SavingsGoalCard';
import { Routes } from '@/constants/routes';
import { TaskCategories } from '@/constants/taskMeta';
import { Colors } from '@/constants/theme';
import { usePlan } from '@/hooks/usePlan';
import { useTasks } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { localMidnight, computeTaskStreak, parseISODateLocal, isTaskDoneOnDate, nextTaskOccurrence, toDateKey, formatShortDate } from '@/utils/date';
import { currentExamWeek } from './dashboardHelpers';
import { dashboardStyles as styles } from './dashboardStyles';
import type { Task } from '@/types/task.types';

interface ExamPathViewProps {
  // Passed in rather than rebuilt here so it doesn't remount on re-render.
  quickLinks: ReactNode;
  onAddExam: () => void;
  onAddSavingsGoal: () => void;
}

export function ExamPathView({ quickLinks, onAddExam, onAddSavingsGoal }: ExamPathViewProps) {
  const router = useRouter();
  const { examPlan, toggleExamTopic } = usePlan();
  const { tasks } = useTasks();
  const { savingsGoal } = useSettings();

  const taskStreak = computeTaskStreak(tasks);

  // Soonest not-yet-done task with a due date, for the "Next session" stat. A
  // recurring task's `dueDate` is fixed at whenever it was first set and never
  // advances, so its actual next occurrence is computed instead — otherwise an
  // ongoing recurring task would vanish here the moment that original date passes.
  // Sorts by calendar day, then by hour within the day.
  const nextTask = tasks
    .map((t) => ({ task: t, date: t.recurring ? nextTaskOccurrence(t) : parseISODateLocal(t.dueDate) }))
    .filter(
      (x): x is { task: Task; date: Date } =>
        !!x.date && !Number.isNaN(x.date.getTime()) && !isTaskDoneOnDate(x.task, x.date)
    )
    .sort((a, b) => {
      const dayDiff = localMidnight(a.date) - localMidnight(b.date);
      return dayDiff !== 0 ? dayDiff : a.task.hour - b.task.hour;
    })[0];

  // Soonest-upcoming first — feeds both the countdown carousel and the "My
  // Exams" list below.
  const sortedExams = [...examPlan.exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
  );

  // "This week" card follows whichever exam is soonest.
  const nearestExam = sortedExams[0];
  const nearestExamWeek = nearestExam ? currentExamWeek(nearestExam) : 0;
  const currentWeekTopic = nearestExam?.topics?.find((t) => t.week === nearestExamWeek);
  const upcomingTopics = (nearestExam?.topics ?? []).filter((t) => t.week >= nearestExamWeek).slice(0, 4);

  const handleToggleExamTopic = async (examId: string, topicId: string) => {
    try {
      await toggleExamTopic(examId, topicId);
    } catch (err) {
      console.error('[ExamPathView] failed to toggle exam topic', err);
    }
  };

  return (
    <>
      {/* Countdown carousel, capped to the nearest 8 (soonest-first) — ExamCarousel
          has no virtualization, so mounting an unbounded list risks a freeze.
          Rest are reachable via "Manage exams" below. */}
      {sortedExams.length > 0 ? (
        <ExamCarousel
          exams={sortedExams.slice(0, 8)}
          onTrackPress={(examId) => router.push({ pathname: Routes.CERT_TRACKER, params: { examId } })}
        />
      ) : (
        <Card style={styles.card}>
          <Text style={styles.eyebrowMuted}>EXAM COUNTDOWN</Text>
          <EmptyState
            icon="plus"
            title="No exam added yet"
            subtitle="Tap to set up your exam and generate a study plan."
            onPress={onAddExam}
          />
        </Card>
      )}

      {quickLinks}

      {/* My Exams */}
      <Card style={styles.card}>
        <SectionCardHeader title="My Exams" actionLabel="Add Exam" onActionPress={onAddExam} />
        {sortedExams.length > 0 ? (
          <View style={{ gap: 8, marginTop: 11 }}>
            {sortedExams.slice(0, 3).map((exam) => (
              <View key={exam.id} style={styles.classRow}>
                <View style={[styles.classBar, { backgroundColor: '#8B3FD1' }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.classRowTitle} numberOfLines={1}>
                    {exam.name}
                  </Text>
                  <Text style={styles.classRowMeta}>
                    {exam.weeksRemaining} week{exam.weeksRemaining > 1 ? 's' : ''} · {exam.hoursPerWeek}h/week
                  </Text>
                </View>
                <Text style={styles.classRowTime}>{formatShortDate(exam.examDate)}</Text>
              </View>
            ))}
            {/* Always shown, even with all exams already listed above — it's the
                only path to the Exams screen where edit/delete live. */}
            <ViewAllRow
              label={
                sortedExams.length > 3
                  ? `View all ${sortedExams.length} exams`
                  : sortedExams.length === 1
                  ? 'Manage exam'
                  : 'Manage exams'
              }
              onPress={() => router.push(Routes.EXAMS)}
            />
          </View>
        ) : (
          <Text style={[styles.noClassText, { marginTop: 10 }]}>No exams added yet.</Text>
        )}
      </Card>

      {/* This week */}
      {nearestExam && (
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.todayTitle}>This week — Week {nearestExamWeek}</Text>
            <Text
              style={[
                styles.examPill,
                { color: TaskCategories.exam.color, backgroundColor: TaskCategories.exam.soft },
              ]}
            >
              {nearestExam.hoursPerWeek}h planned
            </Text>
          </View>
          <Text style={styles.weekTopic}>{currentWeekTopic?.title ?? 'No study topics generated yet'}</Text>
          <View style={{ gap: 7, marginTop: 11 }}>
            {upcomingTopics.map((topic) => {
              const isCurrent = topic.week === nearestExamWeek;
              return (
                <Pressable
                  key={topic.id}
                  style={styles.examTaskRow}
                  onPress={() => handleToggleExamTopic(nearestExam.id, topic.id)}
                >
                  <View
                    style={[
                      styles.examTaskDot,
                      topic.done && { backgroundColor: Colors.successSoft },
                      !topic.done && isCurrent && { borderWidth: 1.7, borderColor: Colors.primaryLight },
                      !topic.done && !isCurrent && { borderWidth: 1.7, borderColor: Colors.border },
                    ]}
                  >
                    {topic.done && <IconSymbol name="checkmark" color={Colors.success} size={11} />}
                  </View>
                  <Text
                    style={[
                      styles.examTaskTitle,
                      !topic.done && isCurrent && { color: Colors.textPrimary, fontWeight: '600' },
                      !topic.done && !isCurrent && { color: Colors.textMuted },
                    ]}
                  >
                    {topic.title}
                  </Text>
                  <Text style={styles.examTaskMeta}>Week {topic.week}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {/* Study streak + Next session */}
      <View style={styles.statsRow}>
        <StatCard label="Study streak" flex={1.3}>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{taskStreak}</Text>
            <Text style={styles.statUnit}>days</Text>
          </View>
        </StatCard>
        <StatCard label="Next session" flex={0.7}>
          {nextTask ? (
            <>
              <Text style={styles.statNextTitle} numberOfLines={1}>
                {nextTask.task.title}
              </Text>
              <Text style={styles.statNextDateMuted}>
                {formatShortDate(toDateKey(nextTask.date))}
                {nextTask.task.time ? ` · ${nextTask.task.time}` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.statNextTitle}>Nothing scheduled</Text>
          )}
        </StatCard>
      </View>

      <SavingsGoalCard
        goal={savingsGoal}
        emptySubtitle="Budget for exam & prep-course fees"
        onPress={onAddSavingsGoal}
      />
    </>
  );
}
