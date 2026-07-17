import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";
import { usePlan } from "@/hooks/usePlan";
import { useOnboarding } from "@/hooks/useOnboarding";
import { planService } from "@/services/plan.service";
import {
  ExamSetupForm,
  EXAM_NAME_PLACEHOLDER,
  DEFAULT_EXAM_WEEKS,
  DEFAULT_EXAM_HOURS,
} from "@/components/plan/ExamSetupForm";
import type { Exam, ExamPlan as ExamPlanType } from "@/types/plan.types";

const MAX_EXAMS = 3;

export default function ExamPlan() {
  const insets = useSafeAreaInsets();
  const { saveExamPlan } = usePlan();
  const { completeOnboarding } = useOnboarding();

  const [exams, setExams] = useState<Exam[]>([]);
  const [examName, setExamName] = useState("");
  const [weeks, setWeeks] = useState(DEFAULT_EXAM_WEEKS);
  const [hours, setHours] = useState(DEFAULT_EXAM_HOURS);
  const [adding, setAdding] = useState(true);
  const [loading, setLoading] = useState(false);

  const PROGRESS = 0.66;

  const resetDraft = () => {
    setExamName("");
    setWeeks(DEFAULT_EXAM_WEEKS);
    setHours(DEFAULT_EXAM_HOURS);
  };

  const handleAddExam = () => {
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
    setExams((prev) => [...prev, exam]);
    resetDraft();
    setAdding(false);
  };

  const removeExam = (id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Generate a week-by-week topic breakdown for each added exam — best-effort,
      // a failed generation just leaves that exam without topics rather than
      // blocking onboarding.
      const examsWithTopics = await Promise.all(
        exams.map(async (exam) => {
          try {
            const suggestions = await planService.generateExamTopics({
              name: exam.name,
              subject: exam.subject,
              hoursPerWeek: exam.hoursPerWeek,
              weeksRemaining: exam.weeksRemaining,
            });
            const topics = suggestions.map((s, i) => ({
              id: `${exam.id}-${i}`,
              title: s.title,
              week: s.week,
              done: false,
            }));
            return { ...exam, topics };
          } catch (err) {
            console.error("[ExamPlan] failed to generate topics for", exam.name, err);
            return exam;
          }
        })
      );

      const planToSave: ExamPlanType = { exams: examsWithTopics };
      await saveExamPlan(planToSave);
      await completeOnboarding();
      router.replace(Routes.DASHBOARD);
    } catch (err) {
      console.error("[ExamPlan] failed to save plan", err);
      Alert.alert("Couldn't save your exams", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace(Routes.DASHBOARD);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.offWhite }}>
      {/* ── Sticky header ── */}
      <View
        style={[styles.stickyHeader, { paddingTop: insets.top + Spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 2 of 3</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${PROGRESS * 100}%` }]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pathBadge}>
          <Text style={styles.pathBadgeText}>Exam Candidate path</Text>
        </View>

        <View style={styles.pageHeader}>
          <Text style={styles.title}>Set up your exam{exams.length > 1 ? "s" : ""}</Text>
          <Text style={styles.subtitle}>
            Tell us the basics. The AI builds a week-by-week plan around your real availability.
          </Text>
        </View>

        {/* Already-added exams */}
        {exams.map((exam, index) => (
          <View key={exam.id} style={styles.examCard}>
            <View style={styles.examCardLeft}>
              <View style={styles.examIndex}>
                <Text style={styles.examIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.examInfo}>
                <Text style={styles.examName}>{exam.name}</Text>
                <View style={styles.examTags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>⏱ {exam.hoursPerWeek}h/week</Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      📅 {exam.weeksRemaining} week{exam.weeksRemaining > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={[styles.tag, styles.tagGreen]}>
                    <Text style={[styles.tagText, { color: Colors.success }]}>
                      ~{exam.hoursPerWeek * exam.weeksRemaining}h total
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => removeExam(exam.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add-exam form */}
        {adding && exams.length < MAX_EXAMS ? (
          <>
            <ExamSetupForm
              examName={examName}
              onExamNameChange={setExamName}
              weeks={weeks}
              hours={hours}
              onWeeksChange={setWeeks}
              onHoursChange={setHours}
            />
            <TouchableOpacity style={styles.addExamBtn} onPress={handleAddExam} activeOpacity={0.85}>
              <Text style={styles.addExamBtnText}>+ Add exam</Text>
            </TouchableOpacity>
          </>
        ) : exams.length < MAX_EXAMS ? (
          <TouchableOpacity style={styles.addAnotherBtn} onPress={() => setAdding(true)} activeOpacity={0.7}>
            <Text style={styles.addAnotherText}>+ Add another exam</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.footer}>
          {exams.length > 0 && (
            <Text style={styles.summaryHint}>
              {exams.length} exam{exams.length > 1 ? "s" : ""} added ✓
            </Text>
          )}
          <Button
            label="Generate my study plan"
            onPress={handleContinue}
            loading={loading}
          />
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipLink}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Sticky header ──
  stickyHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backArrow: {
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  backLabel: {
    ...Typography.body,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  stepBadge: {
    backgroundColor: Colors.overlay,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },

  // ── Scroll ──
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  pathBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1E7FB",
    borderRadius: Radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  pathBadgeText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#8B3FD1",
  },
  pageHeader: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Added exam cards ──
  examCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  examCardLeft: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.md,
  },
  examIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  examIndexText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.white,
  },
  examInfo: {
    flex: 1,
    gap: 4,
  },
  examName: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  examTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: Colors.offWhite,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagGreen: {
    backgroundColor: Colors.accentLight,
    borderColor: "rgba(93, 202, 165, 0.3)",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  removeBtn: {
    padding: 4,
  },
  removeBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
  },

  // ── Add exam button ──
  addExamBtn: {
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  addExamBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.white,
  },

  // ── Add another ──
  addAnotherBtn: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  addAnotherText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary,
  },

  // ── Footer ──
  footer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryHint: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: "600",
    textAlign: "center",
  },
  skipLink: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: "center",
    textDecorationLine: "underline",
    marginTop: Spacing.xs,
  },
});
