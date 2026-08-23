import { GoalSummaryModal } from "@/components/goal/GoalSummaryModal";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { AddClassModal } from "@/components/plan/AddClassModal";
import { AddExamModal } from "@/components/plan/AddExamModal";
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
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { useTasks } from "@/hooks/useTasks";
import { useSyllabi } from "@/hooks/useSyllabi";
import type { ClassItem, Exam } from "@/types/plan.types";
import type { Goal } from "@/types/goal.types";
import { syncClassToAppleCalendar } from "@/utils/appleCalendarSync";
import { scheduleClassNotifications } from "@/utils/notifications";
import { isDueTodayOrLater, localMidnight, parseISODateLocal, isTaskDoneOnDate } from "@/utils/date";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

type PathKey = "student" | "exam" | "professional";

function toPathKey(focusProfile: string | null): PathKey {
  if (focusProfile === "student") return "student";
  if (focusProfile === "exam_candidate") return "exam";
  return "professional";
}

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

// "today" / "tomorrow" / "in N days" — calendar-day comparison (see
// isDueTodayOrLater) so a task due later today still reads as "today", not
// "in 0 days" or wrongly dropped as past.
function relativeDueLabel(dueDateIso: string): string {
  const days = Math.round((localMidnight(parseISODateLocal(dueDateIso)) - localMidnight(new Date())) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

// Thin orchestrator: owns the data/state genuinely shared across every path
// (loading, pull-to-refresh, the four modals, the AI Coach/Habits cards) and
// delegates each path's actual home-screen content to its own view component
// under components/dashboard/ — Student/Exam/Professional are structurally
// unrelated screens that just happen to share a route.
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

  // Nearest real, undone, dated task — soonest due date first — feeds the AI
  // Coach card below so its tip reflects what's actually on the user's plate
  // instead of a fixed placeholder.
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
      // Computed against React's latest state inside updatePlan's updater —
      // Dashboard's "Add class" and Classes tab's "Add class" both call
      // through here/classes.tsx respectively, so adding one from each
      // screen in quick succession no longer risks one silently dropping
      // the other.
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

  // Shared second row on every path's home page (right under the top stats/
  // hero block) — a plain JSX value, not its own component, so it doesn't
  // remount on every render the way a function defined in the render body would.
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
        // The tab bar (app/(app)/_layout.tsx) is 60 + insets.bottom tall —
        // real height, not the flat 40px styles.scrollContent reserves on
        // its own — so without adding it, the bottom of the scroll content
        // sits behind the tab bar and is unreachable even at max scroll.
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
              />
            ) : pathKey === "exam" ? (
              <ExamPathView quickLinks={quickLinksRow} onAddExam={() => setExamModalOpen(true)} />
            ) : (
              <ProfessionalPathView quickLinks={quickLinksRow} onViewGoal={openGoalSummary} />
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
