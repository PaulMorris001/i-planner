/* eslint-disable react/no-unescaped-entities */
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";
import { usePlan } from "@/hooks/usePlan";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { Exam, ExamPlan as ExamPlanType } from "@/types/plan.types";

const MAX_EXAMS = 3;

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14];

function calcWeeksRemaining(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const EMPTY_FORM = {
  name: "",
  subject: "",
  examDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  hoursPerWeek: 4,
};

export default function ExamPlan() {
  const insets = useSafeAreaInsets();
  const { saveExamPlan } = usePlan();
  const { completeOnboarding } = useOnboarding();

  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(true); // show form by default

  const PROGRESS = 0.66;

  const weeksRemaining = calcWeeksRemaining(form.examDate.toISOString());
  const totalHours = weeksRemaining * form.hoursPerWeek;

  const handleAddExam = () => {
    if (!form.name.trim()) {
      Alert.alert("Exam name required", "Please enter a name for this exam.");
      return;
    }
    if (!form.subject.trim()) {
      Alert.alert(
        "Subject required",
        "Please enter the subject for this exam.",
      );
      return;
    }

    const newExam: Exam = {
      id: Date.now().toString(),
      name: form.name.trim(),
      subject: form.subject.trim(),
      examDate: form.examDate.toISOString(),
      hoursPerWeek: form.hoursPerWeek,
      weeksRemaining,
    };

    setExams((prev) => [...prev, newExam]);
    setForm(EMPTY_FORM);
    setAdding(false);
  };

  const removeExam = (id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  const handleContinue = async () => {
    if (exams.length === 0) {
      Alert.alert(
        "No exams added",
        "Add at least one exam to generate your revision plan, or skip to continue.",
        [
          {
            text: "Skip",
            onPress: async () => {
              await completeOnboarding();
              router.replace(Routes.DASHBOARD);
            },
          },
          { text: "Add exam", style: "cancel" },
        ],
      );
      return;
    }
    setLoading(true);
    const planToSave: ExamPlanType = { exams };
    await saveExamPlan(planToSave);
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
        {/* Page heading */}
        <View style={styles.pageHeader}>
          <Text style={styles.title}>Set up your exams</Text>
          <Text style={styles.subtitle}>
            Add up to {MAX_EXAMS} exams. We'll build a revision plan with topic
            checklists and time estimates based on your schedule.
          </Text>
        </View>

        {/* Added exams */}
        {exams.map((exam, index) => (
          <View key={exam.id} style={styles.examCard}>
            <View style={styles.examCardLeft}>
              <View style={styles.examIndex}>
                <Text style={styles.examIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.examInfo}>
                <Text style={styles.examName}>{exam.name}</Text>
                <Text style={styles.examMeta}>
                  {exam.subject} · {formatDate(new Date(exam.examDate))}
                </Text>
                <View style={styles.examTags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      ⏱ {exam.hoursPerWeek}h/week
                    </Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      📅 {exam.weeksRemaining} week
                      {exam.weeksRemaining > 1 ? "s" : ""} left
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

        {/* Add exam form */}
        {adding && exams.length < MAX_EXAMS && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {exams.length === 0 ? "Add your first exam" : "Add another exam"}
            </Text>

            {/* Exam name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Exam name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Final Year Economics"
                placeholderTextColor={Colors.textMuted}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
            </View>

            {/* Subject */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Macroeconomics"
                placeholderTextColor={Colors.textMuted}
                value={form.subject}
                onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
              />
            </View>

            {/* Exam date */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Exam date</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.datePickerIcon}>📅</Text>
                <Text style={styles.datePickerText}>
                  {formatDate(form.examDate)}
                </Text>
                <Text style={styles.datePickerBadge}>
                  {weeksRemaining} week{weeksRemaining > 1 ? "s" : ""} away
                </Text>
              </TouchableOpacity>

              {showPicker && (
                <DateTimePicker
                  value={form.examDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  themeVariant="light"
                  accentColor={Colors.primary}
                  textColor="#000000"
                  onChange={(_, date) => {
                    if (Platform.OS === "android") setShowPicker(false);
                    if (date) setForm((f) => ({ ...f, examDate: date }));
                  }}
                />
              )}
            </View>

            {/* Hours per week */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Available study hours per week
              </Text>
              <View style={styles.hoursGrid}>
                {HOUR_OPTIONS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.hourChip,
                      form.hoursPerWeek === h && styles.hourChipActive,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, hoursPerWeek: h }))}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.hourChipText,
                        form.hoursPerWeek === h && styles.hourChipTextActive,
                      ]}
                    >
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Study summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                📊 You have{" "}
                <Text style={styles.summaryHighlight}>
                  {weeksRemaining} week{weeksRemaining > 1 ? "s" : ""}
                </Text>{" "}
                and roughly{" "}
                <Text style={styles.summaryHighlight}>
                  {totalHours} total study hours
                </Text>{" "}
                before this exam. We'll build your revision checklist around
                this.
              </Text>
            </View>

            {/* Add button */}
            <TouchableOpacity
              style={styles.addExamBtn}
              onPress={handleAddExam}
              activeOpacity={0.85}
            >
              <Text style={styles.addExamBtnText}>+ Add exam</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add another */}
        {!adding && exams.length < MAX_EXAMS && (
          <TouchableOpacity
            style={styles.addAnotherBtn}
            onPress={() => setAdding(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addAnotherText}>+ Add another exam</Text>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {exams.length === 0 ? (
            <Text style={styles.skipHint}>
              Add at least one exam to generate your revision plan.
            </Text>
          ) : (
            <Text style={styles.summaryHint}>
              {exams.length} exam{exams.length > 1 ? "s" : ""} added ✓ — your
              revision plan is ready to generate.
            </Text>
          )}
          <Button
            label="Continue to dashboard"
            onPress={handleContinue}
            loading={loading}
          />
          <TouchableOpacity
            onPress={() => router.replace(Routes.DASHBOARD)}
            activeOpacity={0.7}
          >
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
  examMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
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

  // ── Form card ──
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  formTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },

  // ── Date picker ──
  datePicker: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  datePickerIcon: {
    fontSize: 16,
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
    fontWeight: "600",
  },
  datePickerBadge: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
    backgroundColor: Colors.overlay,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  // ── Hours grid ──
  hoursGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hourChip: {
    width: 52,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.offWhite,
  },
  hourChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hourChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  hourChipTextActive: {
    color: Colors.white,
  },

  // ── Summary box ──
  summaryBox: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(93, 202, 165, 0.25)",
  },
  summaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  summaryHighlight: {
    fontWeight: "700",
    color: Colors.primary,
  },

  // ── Add exam button ──
  addExamBtn: {
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  skipHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: "center",
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
