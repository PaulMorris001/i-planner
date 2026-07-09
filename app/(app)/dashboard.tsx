import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GreetingHeader } from '@/components/ui/GreetingHeader';
import { Colors, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { usePlan } from '@/hooks/usePlan';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useHabits } from '@/hooks/useHabits';
import { useTasks } from '@/hooks/useTasks';
import { TaskCategories } from '@/constants/taskMeta';

const TODAY_SHORT = 'Tue'; // matches student-plan.tsx's day-chip convention and the app's fixed demo "today"

type PathKey = 'student' | 'exam' | 'professional';

function toPathKey(focusProfile: string | null): PathKey {
  if (focusProfile === 'student') return 'student';
  if (focusProfile === 'exam_candidate') return 'exam';
  return 'professional';
}

const AI_TIP: Record<PathKey, string> = {
  student: 'Case Memo 1 is due in 3 days — want me to block study time?',
  exam: "You're on Week 4. Want a quick quiz on this week's topics?",
  professional: 'Your first action is due in 2 days. Want a reminder?',
};

const EXAM_WEEK_TASKS: { title: string; status: 'done' | 'active' | 'todo'; meta?: string }[] = [
  { title: 'Mutual fund structures', status: 'done' },
  { title: 'ETFs & closed-end funds', status: 'active', meta: 'Today · 2h' },
  { title: 'UITs & annuities', status: 'todo' },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const router = useRouter();
  const { professionalPlan, plan, examPlan } = usePlan();
  const { focusProfile } = useOnboarding();
  const { habits } = useHabits();
  const { tasks } = useTasks();
  const careerGoal = professionalPlan.careerGoals[0];
  const financialGoal = professionalPlan.financialGoals[0];
  const habitsDoneToday = habits.filter((h) => h.doneToday).length;

  const [studentTaskDone, setStudentTaskDone] = useState(false);

  const pathKey = toPathKey(focusProfile);

  // Today's class, matched against the app's fixed demo "today" (Tuesday) —
  // same convention student-plan.tsx's day chips and Planner already use.
  const todayClass = plan.classes.find((c) => c.days.includes(TODAY_SHORT));

  // Nearest dated items from onboarding (recruitment tasks + "other" items
  // that were given a date) plus real tasks with a due date, soonest-first
  // and excluding anything already past or done — this feeds both the "Up
  // next" stat card and the UPCOMING list below.
  const studentUpcoming = [
    ...plan.recruitment.map((r) => ({
      title: `${r.company} — ${r.taskType}`,
      date: r.date,
      dotColor: Colors.primaryLight,
    })),
    ...plan.other
      .filter((o) => !!o.date)
      .map((o) => ({ title: o.title, date: o.date, dotColor: Colors.warning })),
    ...tasks
      .filter((t) => !!t.dueDate && !t.done)
      .map((t) => ({ title: t.title, date: t.dueDate, dotColor: TaskCategories[t.category].color })),
  ]
    .filter((item) => new Date(item.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const primaryExam = examPlan.exams[0];
  const examDaysToGo = primaryExam
    ? Math.max(0, Math.ceil((new Date(primaryExam.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <GreetingHeader />

      <View style={styles.stack}>
        {pathKey === 'student' ? (
          <>
            {/* Study streak + Up next */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Study streak</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>5</Text>
                  <Text style={styles.statUnit}>days</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Up next</Text>
                {studentUpcoming.length > 0 ? (
                  <>
                    <Text style={styles.statNextTitle} numberOfLines={1}>
                      {studentUpcoming[0].title}
                    </Text>
                    <Text style={styles.statNextDate}>{formatShortDate(studentUpcoming[0].date)}</Text>
                  </>
                ) : (
                  <Text style={styles.statNextTitle}>Nothing scheduled</Text>
                )}
              </View>
            </View>

            {/* Today */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.todayTitle}>Today</Text>
                {todayClass && (
                  <Text style={styles.todayProgress}>{studentTaskDone ? '1 of 1 done' : '0 of 1 done'}</Text>
                )}
              </View>
              {todayClass ? (
                <Pressable style={styles.todayTaskRow} onPress={() => setStudentTaskDone((d) => !d)}>
                  <View
                    style={[
                      styles.checkbox,
                      studentTaskDone
                        ? { backgroundColor: Colors.primaryLight }
                        : { borderWidth: 1.5, borderColor: Colors.border },
                    ]}
                  >
                    {studentTaskDone && <IconSymbol name="checkmark" color={Colors.white} size={13} />}
                  </View>
                  <Text
                    style={[
                      styles.todayTaskTitle,
                      studentTaskDone && { color: Colors.textMuted, textDecorationLine: 'line-through' },
                    ]}
                  >
                    {todayClass.courseName}
                  </Text>
                  <Text style={styles.todayTaskMeta}>{todayClass.time || 'All day'}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.noClassText, { marginTop: 10 }]}>No classes scheduled today.</Text>
              )}
            </View>

            {/* This week's goal */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.weekGoalTitle}>This week's goal</Text>
                <Text style={styles.mono}>60%</Text>
              </View>
              <Text style={styles.weekGoalSub}>Finish Corporate Finance modules 1–3</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: '60%', backgroundColor: Colors.primaryLight }]} />
              </View>
            </View>

            {/* Upcoming */}
            <View style={{ gap: 9 }}>
              <Text style={styles.eyebrowMuted}>UPCOMING</Text>
              {studentUpcoming.length === 0 && (
                <Text style={styles.noClassText}>
                  Nothing coming up — add recruitment tasks or other items from onboarding.
                </Text>
              )}
              {studentUpcoming.map((item) => (
                <View key={`${item.title}-${item.date}`} style={styles.upcomingRow}>
                  <View style={[styles.upcomingDot, { backgroundColor: item.dotColor }]} />
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.upcomingDate}>{formatShortDate(item.date)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : pathKey === 'exam' ? (
          <>
            {/* Countdown hero */}
            {primaryExam ? (
              <LinearGradient
                colors={['#8B3FD1', '#5A2A99']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Text style={styles.heroLabel}>
                  {primaryExam.name} · {formatShortDate(primaryExam.examDate)}
                </Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{examDaysToGo}</Text>
                  <Text style={styles.heroUnit}>days to go</Text>
                </View>
                <View style={styles.heroProgressTrack}>
                  <View style={[styles.heroProgressFill, { width: '30%' }]} />
                </View>
                <Text style={styles.heroSub}>3 of 10 topics complete</Text>
                <Pressable style={styles.heroButton} onPress={() => router.push(Routes.CERT_TRACKER)}>
                  <Text style={styles.heroButtonText}>Track my progress</Text>
                  <IconSymbol name="chevron.right" color={Colors.white} size={16} />
                </Pressable>
              </LinearGradient>
            ) : (
              <View style={styles.card}>
                <Text style={styles.eyebrowMuted}>EXAM COUNTDOWN</Text>
                <View style={styles.placeholderRow}>
                  <View style={styles.dashedIconBox}>
                    <IconSymbol name="plus" color={Colors.textMuted} size={19} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeholderTitle}>No exam added yet</Text>
                    <Text style={styles.placeholderSub}>
                      Add one from onboarding to see your countdown here.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* This week */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.todayTitle}>This week — Week 4</Text>
                <Text style={[styles.examPill, { color: TaskCategories.exam.color, backgroundColor: TaskCategories.exam.soft }]}>
                  8h planned
                </Text>
              </View>
              <Text style={styles.weekTopic}>Packaged Products & Funds</Text>
              <View style={{ gap: 7, marginTop: 11 }}>
                {EXAM_WEEK_TASKS.map((task) => (
                  <View key={task.title} style={styles.examTaskRow}>
                    <View
                      style={[
                        styles.examTaskDot,
                        task.status === 'done' && { backgroundColor: Colors.successSoft },
                        task.status === 'active' && { borderWidth: 1.7, borderColor: Colors.primaryLight },
                        task.status === 'todo' && { borderWidth: 1.7, borderColor: Colors.border },
                      ]}
                    >
                      {task.status === 'done' && <IconSymbol name="checkmark" color={Colors.success} size={11} />}
                    </View>
                    <Text
                      style={[
                        styles.examTaskTitle,
                        task.status === 'active' && { color: Colors.textPrimary, fontWeight: '600' },
                        task.status === 'todo' && { color: Colors.textMuted },
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.meta && <Text style={styles.examTaskMeta}>{task.meta}</Text>}
                  </View>
                ))}
              </View>
            </View>

            {/* Study streak + Next session */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Study streak</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>12</Text>
                  <Text style={styles.statUnit}>days</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Next session</Text>
                <Text style={styles.statNextTitle}>Today</Text>
                <Text style={styles.statNextDateMuted}>4:00 PM · 2h</Text>
              </View>
            </View>

          </>
        ) : (
          <>
            {/* Career goal */}
            <View style={styles.card}>
              {careerGoal ? (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={styles.eyebrowGreen}>CAREER GOAL</Text>
                    <Text style={styles.mono}>1 / {professionalPlan.careerGoals.length}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{careerGoal.goal}</Text>
                  <Text style={styles.goalMeta}>Target: {careerGoal.targetYear}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.eyebrowMuted}>CAREER GOAL</Text>
                  <View style={styles.placeholderRow}>
                    <View style={styles.dashedIconBox}>
                      <IconSymbol name="plus" color={Colors.textMuted} size={19} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeholderTitle}>Set a career goal</Text>
                      <Text style={styles.placeholderSub}>
                        Add one from your profile to track it here.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Financial goal */}
            <View style={styles.card}>
              {financialGoal ? (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={styles.eyebrowGreen}>FINANCIAL GOAL</Text>
                    <Text style={styles.mono}>1 / {professionalPlan.financialGoals.length}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{financialGoal.goal}</Text>
                  <Text style={styles.goalMeta}>
                    {financialGoal.targetAmount ? `${financialGoal.targetAmount} · ` : ''}
                    Target: {financialGoal.targetYear}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.eyebrowMuted}>FINANCIAL GOAL</Text>
                  <View style={styles.placeholderRow}>
                    <View style={styles.dashedIconBox}>
                      <IconSymbol name="plus" color={Colors.textMuted} size={19} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeholderTitle}>Set a financial goal</Text>
                      <Text style={styles.placeholderSub}>
                        Add one from your profile to track it here.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* AI Coach */}
        <Pressable style={styles.coachCard} onPress={() => router.push(Routes.COACH)}>
          <View style={styles.coachIconBox}>
            <IconSymbol name="sparkles" color={Colors.white} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.coachEyebrow}>AI COACH</Text>
            <Text style={styles.coachText}>{AI_TIP[pathKey]}</Text>
          </View>
          <IconSymbol name="chevron.right" color="rgba(255,255,255,0.6)" size={20} />
        </Pressable>

        {/* Habits */}
        <Pressable style={styles.habitsCard} onPress={() => router.push(Routes.HABITS)}>
          <View style={styles.habitIconBox}>
            <IconSymbol name="flame.fill" color={Colors.warning} size={21} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.habitEyebrow}>HABITS</Text>
            <Text style={styles.habitText}>
              {habitsDoneToday} of {habits.length} done today
            </Text>
          </View>
          <IconSymbol name="chevron.right" color={Colors.textMuted} size={20} />
        </Pressable>

        {/* Quick links */}
        <View style={styles.quickLinksRow}>
          <Pressable style={styles.quickLinkCard} onPress={() => router.push(Routes.PLANNER)}>
            <View style={[styles.quickLinkIconBox, { backgroundColor: Colors.infoSoft }]}>
              <IconSymbol name="calendar" color={Colors.primaryLight} size={20} />
            </View>
            <Text style={styles.quickLinkTitle}>Calendar</Text>
            <Text style={styles.quickLinkSub}>Sync & timeline</Text>
          </Pressable>
          <Pressable style={styles.quickLinkCard} onPress={() => router.push(Routes.GOALS)}>
            <View style={[styles.quickLinkIconBox, { backgroundColor: Colors.successSoft }]}>
              <IconSymbol name="target" color={Colors.success} size={20} />
            </View>
            <Text style={styles.quickLinkTitle}>Goals</Text>
            <Text style={styles.quickLinkSub}>Track & create</Text>
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  stack: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 17,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowGreen: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyebrowMuted: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mono: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 7,
    lineHeight: 21,
  },
  goalMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 13,
  },
  dashedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholderSub: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 11,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 15,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 7,
  },
  statValue: {
    fontSize: 27,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statNextTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 7,
    lineHeight: 18,
  },
  statNextDate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.warning,
    marginTop: 2,
  },
  statNextDateMuted: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  heroCard: {
    borderRadius: 19,
    padding: 20,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.85,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  heroValue: {
    fontSize: 46,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
    lineHeight: 46,
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.9,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 16,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.white,
  },
  heroSub: {
    fontSize: 12.5,
    fontWeight: '500',
    color: Colors.white,
    opacity: 0.9,
    marginTop: 8,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  heroButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.white,
  },
  examPill: {
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  weekTopic: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 11,
  },
  examTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  examTaskDot: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examTaskTitle: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  examTaskMeta: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  todayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  todayProgress: {
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  todayTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTaskTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  todayTaskMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  noClassText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  weekGoalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  weekGoalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 11,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  upcomingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  upcomingTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  upcomingDate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.textPrimary,
    borderRadius: 17,
    padding: 16,
  },
  coachIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginTop: 2,
    lineHeight: 19,
  },
  habitsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 15,
  },
  habitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  habitText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 11,
  },
  quickLinkCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  quickLinkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
  },
  quickLinkSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
