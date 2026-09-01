import { GoalSummaryModal } from "@/components/goal/GoalSummaryModal";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { AddClassModal } from "@/components/plan/AddClassModal";
import { AddExamModal } from "@/components/plan/AddExamModal";
import { SavingsGoalModal } from "@/components/plan/SavingsGoalModal";
import { LogSavingsProgressModal } from "@/components/plan/LogSavingsProgressModal";
import { SyllabusUploadModal } from "@/components/plan/SyllabusUploadModal";
import { ProfileInfoModal } from "@/components/profile/ProfileInfoModal";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { GreetingHeader } from "@/components/ui/GreetingHeader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StudentPathView } from "@/components/dashboard/StudentPathView";
import { ExamPathView } from "@/components/dashboard/ExamPathView";
import { ProfessionalPathView } from "@/components/dashboard/ProfessionalPathView";
import { dashboardStyles as styles } from "@/components/dashboard/dashboardStyles";
import { Routes } from "@/constants/routes";
import { Colors } from "@/constants/theme";
import { useGoals } from "@/hooks/useGoals";
import { useHabits } from "@/hooks/useHabits";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toPathKey, type PathKey } from "@/hooks/usePathKey";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useEditableSheet } from "@/hooks/useEditableSheet";
import { useTasks } from "@/hooks/useTasks";
import { useSyllabi } from "@/hooks/useSyllabi";
import type { ClassItem, Exam } from "@/types/plan.types";
import type { Goal } from "@/types/goal.types";
import type { SavingsGoal } from "@/types/savingsGoal.types";
import { syncClassToAppleCalendar } from "@/utils/appleCalendarSync";
import { scheduleClassNotifications } from "@/utils/notifications";
import { isDueTodayOrLater, localMidnight, parseISODateLocal, isTaskDoneOnDate } from "@/utils/date";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

// Shown when there's no real upcoming task to reference.
const AI_TIP_FALLBACK: Record<PathKey, string> = {
  student: "Nothing urgent on your plate right now — want help planning ahead?",
  exam: "Nothing urgent on your plate right now — want a quick quiz on your topics?",
  professional: "Nothing urgent on your plate right now — want to review your goals?",
};

// Built from the user's actual nearest-due task once one exists, per path.
const AI_TIP_TEMPLATE: Record<PathKey, (title: string, when: string) => string> = {
  student: (title, when) => `${title} is due ${when} — want me to block study time?`,
  exam: (title, when) => `${title} is due ${when} — want a quick quiz on it?`,
  professional: (title, when) => `${title} is due ${when} — want a reminder?`,
};

// "today" / "tomorrow" / "in N days" via calendar-day comparison, so a task
// due later today still reads as "today" rather than "in 0 days".
function relativeDueLabel(dueDateIso: string): string {
  const days = Math.round((localMidnight(parseISODateLocal(dueDateIso)) - localMidnight(new Date())) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

// Owns state shared across every path (loading, pull-to-refresh, modals,
// AI Coach/Habits cards); delegates home-screen content to per-path view
// components under components/dashboard/, which are otherwise unrelated.
export default function Dashboard() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    examPlan,
    updatePlan,
    updateExamPlan,
    refetch: refetchPlan,
    loading: planLoading,
  } = usePlan();
  const { focusProfile } = useOnboarding();
  const { appleCalendarConnected, remindersEnabled } = useSettings();
  // Goal list itself is read directly by each path view via useSavingsGoals() —
  // only the mutators and the shared add/edit sheet state live here, since the
  // modals are rendered once and shared across all three dashboards.
  const { createGoal, updateGoal, deleteGoal } = useSavingsGoals();
  const goalSheet = useEditableSheet<SavingsGoal>();
  const [logProgressTarget, setLogProgressTarget] = useState<SavingsGoal | null>(null);
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits();
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();
  const { loading: goalsLoading, refetch: refetchGoals } = useGoals();
  const { loading: syllabiLoading, refetch: refetchSyllabi } = useSyllabi();
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
  const habitsDoneToday = habits.filter((h) => h.doneToday).length;

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [syllabusModalOpen, setSyllabusModalOpen] = useState(false);
  const [goalSummaryOpen, setGoalSummaryOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);
  const openGoalSummary = (goal: Goal | null) => {
    setViewingGoal(goal);
    setGoalSummaryOpen(true);
  };

  const pathKey = toPathKey(focusProfile);

  // Nearest undone, dated task — feeds the AI Coach card's tip below.
  const nextTask = [...tasks]
    .filter((t) => !!t.dueDate && !isTaskDoneOnDate(t, parseISODateLocal(t.dueDate)) && isDueTodayOrLater(t.dueDate))
    .sort((a, b) => localMidnight(parseISODateLocal(a.dueDate)) - localMidnight(parseISODateLocal(b.dueDate)))[0];
  const coachTip = nextTask
    ? AI_TIP_TEMPLATE[pathKey](nextTask.title, relativeDueLabel(nextTask.dueDate))
    : AI_TIP_FALLBACK[pathKey];

  const handleAddClass = async (item: ClassItem) => {
    const appleEventIds = appleCalendarConnected ? await syncClassToAppleCalendar(item) : [];
    const notificationIds = remindersEnabled ? await scheduleClassNotifications(item) : [];
    try {
      // Computed against React's latest state inside updatePlan's updater, so
      // adding a class from Dashboard and Classes in quick succession can't
      // silently drop one.
      await updatePlan((p) => ({ ...p, classes: [...p.classes, { ...item, appleEventIds, notificationIds }] }));
    } catch (err) {
      console.error("[Dashboard] failed to add class", err);
      Alert.alert("Couldn't add class", "Check your connection and try again.");
    }
  };

  const handleAddExam = async (exam: Exam) => {
    try {
      await updateExamPlan((exams) => [...exams, exam]);
    } catch (err) {
      console.error("[Dashboard] failed to add exam", err);
      Alert.alert(
        "Couldn't save your exam",
        "Check your connection and try again.",
      );
    }
  };

  const handleSaveGoal = async (input: Parameters<typeof createGoal>[0]) => {
    if (goalSheet.editing) {
      await updateGoal(goalSheet.editing.id, input);
    } else {
      await createGoal(input);
    }
  };

  const handleLogProgress = async (goal: SavingsGoal) => {
    await updateGoal(goal.id, { savedAmount: goal.savedAmount });
  };

  // Plain JSX value, not its own component, so it doesn't remount every
  // render the way a function defined in the render body would.
  const quickLinksRow = (
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
  );

  return (
    <>
      <ScreenWrapper
        backgroundColor={Colors.offWhite}
        scroll
        // Tab bar is 60 + insets.bottom tall; without adding tabBarHeight here,
        // the scroll content's bottom sits behind it and is unreachable.
        style={{ ...styles.scrollContent, paddingBottom: styles.scrollContent.paddingBottom + tabBarHeight }}
        edges={["top", "right", "left"]}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      >
        <GreetingHeader onAvatarPress={() => setProfileModalOpen(true)} />

        {dashboardLoading ? (
          <DashboardSkeleton />
        ) : (
          <View style={styles.stack}>
            {pathKey === "student" ? (
              <StudentPathView
                quickLinks={quickLinksRow}
                onAddClass={() => setClassModalOpen(true)}
                onAddSyllabus={() => setSyllabusModalOpen(true)}
                onViewGoal={openGoalSummary}
                onAddSavingsGoal={() => goalSheet.openNew()}
                onEditSavingsGoal={goalSheet.openEdit}
                onLogSavingsProgress={setLogProgressTarget}
              />
            ) : pathKey === "exam" ? (
              <ExamPathView
                quickLinks={quickLinksRow}
                onAddExam={() => setExamModalOpen(true)}
                onAddSavingsGoal={() => goalSheet.openNew()}
                onEditSavingsGoal={goalSheet.openEdit}
                onLogSavingsProgress={setLogProgressTarget}
              />
            ) : (
              <ProfessionalPathView
                quickLinks={quickLinksRow}
                onViewGoal={openGoalSummary}
                onAddSavingsGoal={() => goalSheet.openNew()}
                onEditSavingsGoal={goalSheet.openEdit}
                onLogSavingsProgress={setLogProgressTarget}
              />
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
                <Text style={styles.coachText}>{coachTip}</Text>
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
        hasExistingExams={examPlan.exams.length > 0}
      />
      <SavingsGoalModal
        visible={goalSheet.open}
        onClose={goalSheet.close}
        onSave={handleSaveGoal}
        onRemove={goalSheet.editing ? () => deleteGoal(goalSheet.editing!.id) : undefined}
        editingGoal={goalSheet.editing}
      />
      <LogSavingsProgressModal
        visible={!!logProgressTarget}
        onClose={() => setLogProgressTarget(null)}
        goal={logProgressTarget}
        onLogProgress={handleLogProgress}
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
      <ProfileInfoModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        focusProfile={focusProfile}
      />
    </>
  );
}
