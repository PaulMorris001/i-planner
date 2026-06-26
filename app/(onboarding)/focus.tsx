import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";

const OPTIONS = [
  {
    value: "student",
    icon: "book.fill" as const,
    iconColor: Colors.primary,
    iconBg: "#dae9fc",
    label: "Student",
    description: `Coursework, exams, internship ${"\n"}& academic goals`,
  },
  {
    value: "exam_candidate",
    icon: "pencil" as const,
    iconColor: "#92400E",
    iconBg: "#FEF3C7",
    label: "Exam candidate",
    description: `Prepare for tests with clear${"\n"}revision plans.`,
  },
  {
    value: "professional",
    icon: "briefcase.fill" as const,
    iconColor: "#065F46",
    iconBg: "#DCFCE7",
    label: "Professional",
    description: `Project, certifications & career ${"\n"}growth`,
  },
] as const;

export default function Focus() {
  const { setFocusProfile } = useOnboarding();
  const [selected, setSelected] = useState<
    (typeof OPTIONS)[number]["value"] | null
  >(null);

  const handleContinue = async () => {
    if (!selected) return;
    await setFocusProfile(selected);
    if (selected === "student") {
      router.push(Routes.STUDENT_PLAN);
    } else if (selected === "exam_candidate") {
      router.push(Routes.EXAM_PLAN);
    } else {
      router.push(Routes.PROFESSIONAL_PLAN);
    }
  };

  const totalSteps = 3;
  const currentStep = 0;
  const progressValue = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <ScreenWrapper backgroundColor={Colors.white} scroll>
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.progressSection}>
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBackground} />
              <View
                style={[styles.progressBarFill, { width: `${progressValue}%` }]}
              />
            </View>
          </View>

          <Text style={styles.title}>What are you {"\n"}focused on?</Text>
          <Text style={styles.subtitle}>
            We will tailor your dashboard and AI Coach to match. You can change
            this anytime.
          </Text>

          {/* Card */}

          <View style={styles.cardGrid}>
            {OPTIONS.map((option) => {
              const active = selected === option.value;
              return (
                <Card
                  key={option.value}
                  onPress={() => setSelected(option.value)}
                  style={[
                    styles.card,
                    styles.cardShadow,
                    active && styles.cardActive,
                    active && styles.cardActiveShadow,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View
                        style={[
                          styles.optionIcon,
                          { backgroundColor: option.iconBg },
                        ]}
                      >
                        <IconSymbol
                          name={option.icon as IconSymbolName}
                          size={20}
                          color={option.iconColor}
                        />
                      </View>
                      <View style={styles.cardTitleCol}>
                        <Text
                          style={[
                            styles.cardTitle,
                            active && styles.cardTitleActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text style={styles.cardDescription}>
                          {option.description}
                        </Text>
                      </View>
                    </View>

                    
                    <View
                      style={[
                        styles.tickWrapper,
                        active && styles.tickWrapperActive,
                      ]}
                    >
                      <IconSymbol
                        name="checkmark"
                        size={12}
                        color={active ? Colors.white : Colors.primary}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!selected}
            style={styles.cta}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginLeft: 0,
    textAlign: "left",
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  progressSection: {
    marginBottom: Spacing.xl,
  },
  progressBarWrapper: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  progressBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.accent,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  progressSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardGrid: {
    gap: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.white,
  },
  cardShadow: {
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  cardActiveShadow: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  cardActive: {
    borderColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTitleCol: {
    flexDirection: "column",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...Typography.subtitle,
    color: Colors.textPrimary,
    flexShrink: 1,
    flexWrap: "wrap",
    paddingRight: Spacing.sm,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  tickWrapper: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  tickWrapperActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  cardTitleActive: {
    color: Colors.primary,
  },
  cardDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  cta: {
    marginTop: Spacing.xl,
  },
});
