import { GoalSummaryModal } from "@/components/goal/GoalSummaryModal";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { AddClassModal } from "@/components/plan/AddClassModal";
import { AddExamModal } from "@/components/plan/AddExamModal";
import { SyllabusUploadModal } from "@/components/plan/SyllabusUploadModal";
import { ExamCarousel } from "@/components/plan/ExamCarousel";
import { AnimatedProgressBar } from "@/components/ui/AnimatedProgressBar";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { GreetingHeader } from "@/components/ui/GreetingHeader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { COURSE_COLORS } from "@/constants/classColors";
import { Routes } from "@/constants/routes";
import { TaskCategories } from "@/constants/taskMeta";
import { Colors, Spacing } from "@/constants/theme";
import { useGoals } from "@/hooks/useGoals";
import { useHabits } from "@/hooks/useHabits";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { useTasks } from "@/hooks/useTasks";
import { useSyllabi } from "@/hooks/useSyllabi";
import type {
  ClassItem,
  Exam,
  ExamPlan as ExamPlanType,
} from "@/types/plan.types";
import type { Goal } from "@/types/goal.types";
import { formatMonthYear, weekdayIndexMonday, taskOccursOnDay, computeTaskStreak } from "@/utils/date";
import { parseTimeToMinutes } from "@/utils/time";
import { syncClassToAppleCalendar } from "@/utils/appleCalendarSync";
import { scheduleClassNotifications } from "@/utils/notifications";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function classDaysLabel(item: ClassItem): string {
  if (!item.recurring) return "One time";
  if (item.freq === "monthly") return "Monthly";
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join(" · ");
}

type PathKey = "student" | "exam" | "professional";

function toPathKey(focusProfile: string | null): PathKey {
  if (focusProfile === "student") return "student";
  if (focusProfile === "exam_candidate") return "exam";
  return "professional";
}

const AI_TIP: Record<PathKey, string> = {
  student: "Case Memo 1 is due in 3 days — want me to block study time?",
  exam: "You're on Week 4. Want a quick quiz on this week's topics?",
  professional: "Your first action is due in 2 days. Want a reminder?",
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Which of the exam's generated topics (1-based week numbers) is "this week",
// counted backward from the exam date — the last topic lands in the exam's
// final week, the first as far back as the topic count allows.
function currentExamWeek(exam: Exam): number {
  const totalWeeks = exam.topics?.length || exam.weeksRemaining;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksUntilExam = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / msPerWeek);
  return Math.min(totalWeeks, Math.max(1, totalWeeks - weeksUntilExam + 1));
}

// True when dateIso falls within the current Monday-Sunday week.
function isThisWeek(dateIso: string): boolean {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekdayIndexMonday(now));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return date >= monday && date < nextMonday;
}

export default function Dashboard() {
  const router = useRouter();
  const {
    plan,
    examPlan,
    savePlan,
    saveExamPlan,
    toggleExamTopic,
    refetch: refetchPlan,
    loading: planLoading,
  } = usePlan();
  const { focusProfile } = useOnboarding();
  const { appleCalendarConnected, remindersEnabled } = useSettings();
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits();
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();
  const { goals, loading: goalsLoading, refetch: refetchGoals } = useGoals();
  const { syllabi, loading: syllabiLoading, refetch: refetchSyllabi } = useSyllabi();
  const dashboardLoading =
    planLoading || habitsLoading || tasksLoading || goalsLoading || syllabiLoading;
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPlan(), refetchTasks(), refetchHabits(), refetchGoals(), refetchSyllabi()]);
    } finally {
      setRefreshing(false);
    }
  };
  const careerGoal = goals.find((g) => g.type === "career");
  const careerMilestonesDone =
    careerGoal?.milestones.filter((m) => m.done).length ?? 0;
  const nextCareerMilestone = careerGoal?.milestones.find((m) => !m.done);
  const habitsDoneToday = habits.filter((h) => h.doneToday).length;
  const thisWeeksGoals = goals.filter((g) => g.targetDate && isThisWeek(g.targetDate));

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [syllabusModalOpen, setSyllabusModalOpen] = useState(false);
  const [goalSummaryOpen, setGoalSummaryOpen] = useState(false);
  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);
  const openGoalSummary = (goal: Goal | null) => {
    setViewingGoal(goal);
    setGoalSummaryOpen(true);
  };

  const pathKey = toPathKey(focusProfile);

  // Classes happening today, matched against the real current weekday.
  const todayIdx = weekdayIndexMonday(new Date());
  const todaysClasses = plan.classes
    .filter((c) => (c.dayIdxs ?? []).includes(todayIdx))
    .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

  // Today's task completion, for the Professional path's "Today's tasks" stat.
  const todaysTasks = tasks.filter((t) => taskOccursOnDay(t, todayIdx));
  const todaysTasksDone = todaysTasks.filter((t) => t.done).length;
  const taskStreak = computeTaskStreak(tasks);

  // Most-recently-created first — class ids are Date.now() timestamps, so a
  // numeric sort on id doubles as a creation-order sort.
  const recentClasses = [...plan.classes].sort(
    (a, b) => Number(b.id) - Number(a.id),
  );
  const visibleClasses = recentClasses.slice(0, 3);

  const handleAddClass = async (item: ClassItem) => {
    const appleEventIds = appleCalendarConnected ? await syncClassToAppleCalendar(item) : [];
    const notificationIds = remindersEnabled ? await scheduleClassNotifications(item) : [];
    try {
      await savePlan({ ...plan, classes: [...plan.classes, { ...item, appleEventIds, notificationIds }] });
    } catch (err) {
      console.error("[Dashboard] failed to add class", err);
      Alert.alert("Couldn't add class", "Check your connection and try again.");
    }
  };

  const handleAddExam = async (exam: Exam) => {
    try {
      const updated: ExamPlanType = { exams: [...examPlan.exams, exam] };
      await saveExamPlan(updated);
    } catch (err) {
      console.error("[Dashboard] failed to add exam", err);
      Alert.alert(
        "Couldn't save your exam",
        "Check your connection and try again.",
      );
    }
  };

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
      .map((t) => ({
        title: t.title,
        date: t.dueDate,
        dotColor: TaskCategories[t.category].color,
      })),
  ]
    .filter((item) => new Date(item.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  // Soonest-upcoming first — feeds both the countdown carousel and the "My
  // Exams" list below.
  const sortedExams = [...examPlan.exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
  );

  // "This week" card follows whichever exam is soonest.
  const nearestExam = sortedExams[0];
  const nearestExamWeek = nearestExam ? currentExamWeek(nearestExam) : 0;
  const currentWeekTopic = nearestExam?.topics?.find((t) => t.week === nearestExamWeek);
  const upcomingTopics = (nearestExam?.topics ?? [])
    .filter((t) => t.week >= nearestExamWeek)
    .slice(0, 4);

  const handleToggleExamTopic = async (examId: string, topicId: string) => {
    try {
      await toggleExamTopic(examId, topicId);
    } catch (err) {
      console.error("[Dashboard] failed to toggle exam topic", err);
    }
  };

  return (
    <>
      <ScreenWrapper
        backgroundColor={Colors.offWhite}
        scroll
        style={styles.scrollContent}
        edges={["top", "right", "left"]}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      >
        <GreetingHeader />

        {dashboardLoading ? (
          <DashboardSkeleton />
        ) : (
          <View style={styles.stack}>
            {pathKey === "student" ? (
              <>
                {/* Study streak + Up next */}
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { flex: 1.3 }]}>
                    <Text style={styles.statLabel}>Study streak</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>{taskStreak}</Text>
                      <Text style={styles.statUnit}>days</Text>
                    </View>
                  </View>
                  <View style={[styles.statCard, { flex: 0.7 }]}>
                    <Text style={styles.statLabel}>Up next</Text>
                    {studentUpcoming.length > 0 ? (
                      <>
                        <Text style={styles.statNextTitle} numberOfLines={1}>
                          {studentUpcoming[0].title}
                        </Text>
                        <Text style={styles.statNextDate}>
                          {formatShortDate(studentUpcoming[0].date)}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.statNextTitle}>
                        Nothing scheduled
                      </Text>
                    )}
                  </View>
                </View>

                {/* Today's Classes */}
                <View style={styles.card}>
                  <Text style={styles.todayTitle}>Today's Classes</Text>
                  {todaysClasses.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 11 }}>
                      {todaysClasses.map((c) => {
                        const color =
                          COURSE_COLORS[
                            plan.classes.indexOf(c) % COURSE_COLORS.length
                          ];
                        return (
                          <View key={c.id} style={styles.classRow}>
                            <View
                              style={[
                                styles.classBar,
                                { backgroundColor: color },
                              ]}
                            />
                            <Text
                              style={styles.classRowTitle}
                              numberOfLines={1}
                            >
                              {c.courseName}
                            </Text>
                            <Text style={styles.classRowTime}>{c.time}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.noClassText, { marginTop: 10 }]}>
                      No classes scheduled today.
                    </Text>
                  )}
                </View>

                {/* My Classes */}
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.todayTitle}>My Classes</Text>
                    <Pressable
                      style={styles.addClassBtn}
                      onPress={() => setClassModalOpen(true)}
                    >
                      <IconSymbol
                        name="plus"
                        color={Colors.primaryLight}
                        size={13}
                      />
                      <Text style={styles.addClassBtnText}>Add Class</Text>
                    </Pressable>
                  </View>
                  {visibleClasses.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 11 }}>
                      {visibleClasses.map((c) => {
                        const color =
                          COURSE_COLORS[
                            plan.classes.indexOf(c) % COURSE_COLORS.length
                          ];
                        return (
                          <View key={c.id} style={styles.classRow}>
                            <View
                              style={[
                                styles.classBar,
                                { backgroundColor: color },
                              ]}
                            />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={styles.classRowTitle}
                                numberOfLines={1}
                              >
                                {c.courseName}
                              </Text>
                              <Text style={styles.classRowMeta}>
                                {classDaysLabel(c)}
                                {c.time ? ` · ${c.time}` : ""}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      {plan.classes.length > 3 && (
                        <Pressable
                          style={styles.viewAllRow}
                          onPress={() => router.push(Routes.CLASSES)}
                        >
                          <Text style={styles.viewAllText}>
                            View all {plan.classes.length} classes
                          </Text>
                          <IconSymbol
                            name="chevron.right"
                            color={Colors.primaryLight}
                            size={14}
                          />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.noClassText, { marginTop: 10 }]}>
                      No classes added yet.
                    </Text>
                  )}
                </View>

                {/* My Syllabi */}
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.todayTitle}>My Syllabi</Text>
                    <Pressable
                      style={styles.addClassBtn}
                      onPress={() => setSyllabusModalOpen(true)}
                    >
                      <IconSymbol
                        name="plus"
                        color={Colors.primaryLight}
                        size={13}
                      />
                      <Text style={styles.addClassBtnText}>Add Syllabus</Text>
                    </Pressable>
                  </View>
                  {syllabi.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 11 }}>
                      {syllabi.slice(0, 3).map((sy) => (
                        <View key={sy.id} style={styles.syllabusRow}>
                          <View style={styles.syllabusIconBox}>
                            <IconSymbol
                              name="doc.fill"
                              color={Colors.primaryLight}
                              size={15}
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={styles.classRowTitle}
                              numberOfLines={1}
                            >
                              {sy.courseName}
                            </Text>
                            <Text style={styles.classRowMeta} numberOfLines={1}>
                              {sy.fileName}
                            </Text>
                          </View>
                        </View>
                      ))}
                      {syllabi.length > 3 && (
                        <Pressable
                          style={styles.viewAllRow}
                          onPress={() => router.push(Routes.SYLLABI)}
                        >
                          <Text style={styles.viewAllText}>
                            View all {syllabi.length} syllabi
                          </Text>
                          <IconSymbol
                            name="chevron.right"
                            color={Colors.primaryLight}
                            size={14}
                          />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.noClassText, { marginTop: 10 }]}>
                      No syllabi yet.
                    </Text>
                  )}
                </View>

                {/* This week's goal(s) */}
                <View style={{ gap: 9 }}>
                  <Text style={styles.eyebrowMuted}>
                    {thisWeeksGoals.length > 1 ? "THIS WEEK'S GOALS" : "THIS WEEK'S GOAL"}
                  </Text>
                  {thisWeeksGoals.length === 0 ? (
                    <Pressable
                      style={styles.placeholderRow}
                      onPress={() => router.push(Routes.GOALS)}
                    >
                      <View style={styles.dashedIconBox}>
                        <IconSymbol name="target" color={Colors.textMuted} size={19} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.placeholderTitle}>No goals due this week</Text>
                        <Text style={styles.placeholderSub}>
                          Set a due date on a goal to see it here.
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    thisWeeksGoals.map((goal) => (
                      <View key={goal.id} style={styles.card}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.weekGoalTitle} numberOfLines={1}>
                            {goal.title}
                          </Text>
                          <Text style={styles.mono}>{goal.pct}%</Text>
                        </View>
                        <View style={[styles.progressTrack, { marginTop: 10 }]}>
                          <AnimatedProgressBar pct={goal.pct} color={Colors.primaryLight} />
                        </View>
                        <Pressable
                          style={[styles.viewButton, { alignSelf: "flex-end", marginTop: 11 }]}
                          onPress={() => openGoalSummary(goal)}
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>

                {/* Upcoming */}
                <View style={{ gap: 9 }}>
                  <Text style={styles.eyebrowMuted}>UPCOMING</Text>
                  {studentUpcoming.length === 0 && (
                    <Text style={styles.noClassText}>
                      Nothing coming up — add recruitment tasks or other items
                      from onboarding.
                    </Text>
                  )}
                  {studentUpcoming.map((item) => (
                    <View
                      key={`${item.title}-${item.date}`}
                      style={styles.upcomingRow}
                    >
                      <View
                        style={[
                          styles.upcomingDot,
                          { backgroundColor: item.dotColor },
                        ]}
                      />
                      <Text style={styles.upcomingTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.upcomingDate}>
                        {formatShortDate(item.date)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : pathKey === "exam" ? (
              <>
                {/* Countdown carousel — one big card per exam, auto-rotating */}
                {sortedExams.length > 0 ? (
                  <ExamCarousel
                    exams={sortedExams}
                    onTrackPress={(examId) =>
                      router.push({ pathname: Routes.CERT_TRACKER, params: { examId } })
                    }
                  />
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.eyebrowMuted}>EXAM COUNTDOWN</Text>
                    <Pressable
                      style={styles.placeholderRow}
                      onPress={() => setExamModalOpen(true)}
                    >
                      <View style={styles.dashedIconBox}>
                        <IconSymbol
                          name="plus"
                          color={Colors.textMuted}
                          size={19}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.placeholderTitle}>
                          No exam added yet
                        </Text>
                        <Text style={styles.placeholderSub}>
                          Tap to set up your exam and generate a study plan.
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )}

                {/* My Exams */}
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.todayTitle}>My Exams</Text>
                    <Pressable
                      style={styles.addClassBtn}
                      onPress={() => setExamModalOpen(true)}
                    >
                      <IconSymbol
                        name="plus"
                        color={Colors.primaryLight}
                        size={13}
                      />
                      <Text style={styles.addClassBtnText}>Add Exam</Text>
                    </Pressable>
                  </View>
                  {sortedExams.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 11 }}>
                      {sortedExams.slice(0, 3).map((exam) => (
                        <View key={exam.id} style={styles.classRow}>
                          <View
                            style={[
                              styles.classBar,
                              { backgroundColor: "#8B3FD1" },
                            ]}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={styles.classRowTitle}
                              numberOfLines={1}
                            >
                              {exam.name}
                            </Text>
                            <Text style={styles.classRowMeta}>
                              {exam.weeksRemaining} week
                              {exam.weeksRemaining > 1 ? "s" : ""} ·{" "}
                              {exam.hoursPerWeek}h/week
                            </Text>
                          </View>
                          <Text style={styles.classRowTime}>
                            {formatShortDate(exam.examDate)}
                          </Text>
                        </View>
                      ))}
                      {sortedExams.length > 3 && (
                        <Pressable
                          style={styles.viewAllRow}
                          onPress={() => router.push(Routes.EXAMS)}
                        >
                          <Text style={styles.viewAllText}>
                            View all {sortedExams.length} exams
                          </Text>
                          <IconSymbol
                            name="chevron.right"
                            color={Colors.primaryLight}
                            size={14}
                          />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.noClassText, { marginTop: 10 }]}>
                      No exams added yet.
                    </Text>
                  )}
                </View>

                {/* This week */}
                {nearestExam && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.todayTitle}>This week — Week {nearestExamWeek}</Text>
                      <Text
                        style={[
                          styles.examPill,
                          {
                            color: TaskCategories.exam.color,
                            backgroundColor: TaskCategories.exam.soft,
                          },
                        ]}
                      >
                        {nearestExam.hoursPerWeek}h planned
                      </Text>
                    </View>
                    <Text style={styles.weekTopic}>
                      {currentWeekTopic?.title ?? "No study topics generated yet"}
                    </Text>
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
                                !topic.done &&
                                  isCurrent && { borderWidth: 1.7, borderColor: Colors.primaryLight },
                                !topic.done &&
                                  !isCurrent && { borderWidth: 1.7, borderColor: Colors.border },
                              ]}
                            >
                              {topic.done && (
                                <IconSymbol name="checkmark" color={Colors.success} size={11} />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.examTaskTitle,
                                !topic.done && isCurrent && { color: Colors.textPrimary, fontWeight: "600" },
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
                  </View>
                )}

                {/* Study streak + Next session */}
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { flex: 1.3 }]}>
                    <Text style={styles.statLabel}>Study streak</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>{taskStreak}</Text>
                      <Text style={styles.statUnit}>days</Text>
                    </View>
                  </View>
                  <View style={[styles.statCard, { flex: 0.7 }]}>
                    <Text style={styles.statLabel}>Next session</Text>
                    <Text style={styles.statNextTitle}>Today</Text>
                    <Text style={styles.statNextDateMuted}>4:00 PM · 2h</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Today's tasks + Weekly action */}
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Today's tasks</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>{todaysTasksDone}</Text>
                      <Text style={styles.statUnit}>
                        / {todaysTasks.length} done
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Weekly action</Text>
                    <Text style={styles.statNextTitle} numberOfLines={2}>
                      {nextCareerMilestone?.title ?? "Nothing this week"}
                    </Text>
                  </View>
                </View>

                {/* Career goal */}
                <View style={styles.card}>
                  {careerGoal ? (
                    <>
                      <View style={styles.rowBetween}>
                        <Text style={styles.eyebrowGreen}>CAREER GOAL</Text>
                        <Text style={styles.mono}>
                          {careerMilestonesDone} /{" "}
                          {careerGoal.milestones.length}
                        </Text>
                      </View>
                      <Text style={styles.cardTitle}>{careerGoal.title}</Text>
                      {!!(
                        careerGoal.targetRole ||
                        careerGoal.targetIndustry ||
                        careerGoal.targetDate
                      ) && (
                        <Text style={styles.goalMeta}>
                          {[
                            careerGoal.targetRole,
                            careerGoal.targetIndustry,
                            careerGoal.targetDate
                              ? formatMonthYear(careerGoal.targetDate)
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      )}

                      <View style={[styles.rowBetween, { marginTop: 13 }]}>
                        <Text style={styles.careerPct}>{careerGoal.pct}%</Text>
                        <Text style={styles.goalMeta}>
                          {careerMilestonesDone} /{" "}
                          {careerGoal.milestones.length} milestones
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <AnimatedProgressBar
                          pct={careerGoal.pct}
                          color={Colors.success}
                        />
                      </View>

                      {nextCareerMilestone && (
                        <View style={styles.weeklyActionRow}>
                          <IconSymbol
                            name="clock"
                            color={Colors.textSecondary}
                            size={16}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.weeklyActionLabel}>
                              WEEKLY CAREER ACTION
                            </Text>
                            <Text
                              style={styles.weeklyActionTitle}
                              numberOfLines={1}
                            >
                              {nextCareerMilestone.title}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.viewButton}
                            onPress={() => openGoalSummary(careerGoal ?? null)}
                          >
                            <Text style={styles.viewButtonText}>View</Text>
                          </Pressable>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.eyebrowMuted}>CAREER GOAL</Text>
                      <Pressable
                        style={styles.placeholderRow}
                        onPress={() => router.push(Routes.GOALS)}
                      >
                        <View style={styles.dashedIconBox}>
                          <IconSymbol
                            name="plus"
                            color={Colors.textMuted}
                            size={19}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.placeholderTitle}>
                            Set a career goal
                          </Text>
                          <Text style={styles.placeholderSub}>
                            Add one from the Goals page to track it here.
                          </Text>
                        </View>
                      </Pressable>
                    </>
                  )}
                </View>
              </>
            )}

            {/* AI Coach */}
            <Pressable
              style={styles.coachCard}
              onPress={() => router.push(Routes.COACH)}
            >
              <View style={styles.coachIconBox}>
                <IconSymbol name="sparkles" color={Colors.white} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coachEyebrow}>AI COACH</Text>
                <Text style={styles.coachText}>{AI_TIP[pathKey]}</Text>
              </View>
              <IconSymbol
                name="chevron.right"
                color="rgba(255,255,255,0.6)"
                size={20}
              />
            </Pressable>

            {/* Habits */}
            <Pressable
              style={styles.habitsCard}
              onPress={() => router.push(Routes.HABITS)}
            >
              <View style={styles.habitIconBox}>
                <IconSymbol
                  name="flame.fill"
                  color={Colors.warning}
                  size={21}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.habitEyebrow}>HABITS</Text>
                <Text style={styles.habitText}>
                  {habitsDoneToday} of {habits.length} done today
                </Text>
              </View>
              <IconSymbol
                name="chevron.right"
                color={Colors.textMuted}
                size={20}
              />
            </Pressable>

            {/* Quick links */}
            <View style={styles.quickLinksRow}>
              <Pressable
                style={styles.quickLinkCard}
                onPress={() => router.push(Routes.PLANNER)}
              >
                <View
                  style={[
                    styles.quickLinkIconBox,
                    { backgroundColor: Colors.infoSoft },
                  ]}
                >
                  <IconSymbol
                    name="calendar"
                    color={Colors.primaryLight}
                    size={20}
                  />
                </View>
                <Text style={styles.quickLinkTitle}>Calendar</Text>
                <Text style={styles.quickLinkSub}>Sync & timeline</Text>
              </Pressable>
              <Pressable
                style={styles.quickLinkCard}
                onPress={() => router.push(Routes.GOALS)}
              >
                <View
                  style={[
                    styles.quickLinkIconBox,
                    { backgroundColor: Colors.successSoft },
                  ]}
                >
                  <IconSymbol name="target" color={Colors.success} size={20} />
                </View>
                <Text style={styles.quickLinkTitle}>Goals</Text>
                <Text style={styles.quickLinkSub}>Track & create</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScreenWrapper>
      <AddClassModal
        visible={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        onAdd={handleAddClass}
      />
      <AddExamModal
        visible={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        onAdd={handleAddExam}
      />
      <GoalSummaryModal
        visible={goalSummaryOpen}
        onClose={() => setGoalSummaryOpen(false)}
        goal={viewingGoal}
      />
      <SyllabusUploadModal
        visible={syllabusModalOpen}
        onClose={() => setSyllabusModalOpen(false)}
      />
    </>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrowGreen: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eyebrowMuted: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mono: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 7,
    lineHeight: 21,
  },
  goalMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  careerPct: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.success,
    letterSpacing: -0.4,
  },
  weeklyActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    padding: 12,
    marginTop: 13,
  },
  weeklyActionLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  weeklyActionTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: Colors.infoSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 13,
  },
  dashedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  placeholderSub: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: "row",
    gap: 11,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 7,
  },
  statValue: {
    fontSize: 27,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  statNextTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 7,
    lineHeight: 18,
  },
  statNextDate: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.warning,
    marginTop: 2,
  },
  statNextDateMuted: {
    fontSize: 12.5,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  examPill: {
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  weekTopic: {
    fontSize: 14.5,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 11,
  },
  examTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  examTaskDot: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: "center",
    justifyContent: "center",
  },
  examTaskTitle: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  examTaskMeta: {
    fontSize: 11.5,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  todayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  addClassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.infoSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  addClassBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  classBar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  classRowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  classRowTime: {
    fontSize: 12.5,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  classRowMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  syllabusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  syllabusIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.infoSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  noClassText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  weekGoalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 11,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  upcomingDate: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  coachCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: Colors.textPrimary,
    borderRadius: 17,
    padding: 16,
  },
  coachIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coachText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
    marginTop: 2,
    lineHeight: 19,
  },
  habitsCard: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  habitEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  habitText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  quickLinksRow: {
    flexDirection: "row",
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
    alignItems: "center",
    justifyContent: "center",
  },
  quickLinkTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 10,
  },
  quickLinkSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
