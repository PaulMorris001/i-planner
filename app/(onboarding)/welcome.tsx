import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, StyleSheet } from "react-native";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";

// Decorative only — the auto-cycling "selection" below just changes the CTA's
// label for engagement ("Build my Career plan →"). It doesn't persist
// anywhere and isn't the real path choice: that's still Focus (focus.tsx),
// reached after signup, with its own Student/Exam candidate/Professional
// options. These four categories are a marketing-facing hook, not a fourth
// onboarding path — and per their own design, not user-interactive at all.
interface FocusOption {
  id: string;
  label: string;
  desc: string;
  icon: IconSymbolName;
  iconColor: string;
  iconBg: string;
}

// Grid order == visual position (2 columns): index 0/1 is the top row,
// 2/3 the bottom row — i.e. 0=top-left, 1=top-right, 2=bottom-left,
// 3=bottom-right.
const FOCUS_OPTIONS: FocusOption[] = [
  {
    id: "academics",
    label: "Academics",
    desc: "Grades & study",
    icon: "book.fill",
    iconColor: "#FBBF24",
    iconBg: "rgba(251,191,36,0.18)",
  },
  {
    id: "career",
    label: "Career",
    desc: "Skills & goals",
    icon: "briefcase.fill",
    iconColor: "#60A5FA",
    iconBg: "rgba(96,165,250,0.18)",
  },
  {
    id: "money",
    label: "Money",
    desc: "Save & budget",
    icon: "banknote.fill",
    iconColor: "#34D399",
    iconBg: "rgba(52,211,153,0.18)",
  },
  {
    id: "productivity",
    label: "Time & Productivity",
    desc: "Focus & habits",
    icon: "clock",
    iconColor: "#A78BFA",
    iconBg: "rgba(167,139,250,0.18)",
  },
];

// Walks the 2x2 grid clockwise from the top-left: top-left(0) → top-right(1)
// → bottom-right(3) → bottom-left(2) → back to top-left. NOT array order —
// FOCUS_OPTIONS is laid out row-by-row (0,1,2,3), which visually zig-zags
// rather than going clockwise.
const CLOCKWISE_INDICES = [0, 1, 3, 2];
const CYCLE_INTERVAL_MS = 3000;
const FADE_MS = 450;

function FocusCard({ option, active }: { option: FocusOption; active: boolean }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: false, // color/opacity interpolation, not transform
    }).start();
  }, [active, progress]);

  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.1)", Colors.primaryLight],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.05)", "rgba(59,130,246,0.1)"],
  });

  return (
    // Not a Pressable — this cycles on its own on a timer and is never
    // meant to respond to touch at all.
    <Animated.View style={[styles.card, { borderColor, backgroundColor }]}>
      <Animated.View style={[styles.checkBadge, { opacity: progress, transform: [{ scale: progress }] }]}>
        <IconSymbol name="checkmark" color={Colors.white} size={11} />
      </Animated.View>
      <View style={[styles.cardIconBox, { backgroundColor: option.iconBg }]}>
        <IconSymbol name={option.icon} color={option.iconColor} size={18} />
      </View>
      <Text style={styles.cardLabel}>{option.label}</Text>
      <Text style={styles.cardDesc}>{option.desc}</Text>
    </Animated.View>
  );
}

export default function Welcome() {
  const [step, setStep] = useState(0);
  const activeIndex = CLOCKWISE_INDICES[step % CLOCKWISE_INDICES.length];
  const selectedOption = FOCUS_OPTIONS[activeIndex];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), CYCLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <ScreenWrapper backgroundColor={Colors.primary} scroll>
      <View style={styles.root}>
        {/* Decorative circle */}
        <View style={styles.circle} />

        {/* Grouped so `root`'s justifyContent: 'space-between' below has
            exactly two children to split between — everything here stays
            naturally top-aligned, and Actions gets pushed to the bottom of
            the screen instead of sitting right after the grid. */}
        <View>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logoMark}
            resizeMode="contain"
          />

          <Text style={styles.headline}>Let’s get your{"\n"}life organised.</Text>

          <Text style={styles.sub}>
            Tell us what you’re working toward, and I-Planner will turn it into a plan you can
            actually follow.
          </Text>

          <Text style={styles.eyebrow}>WHAT ARE YOU FOCUSING ON?</Text>
          <View style={styles.grid}>
            {FOCUS_OPTIONS.map((option, i) => (
              <FocusCard key={option.id} option={option} active={i === activeIndex} />
            ))}
          </View>
        </View>

        {/* Actions — bottom-aligned via root's justifyContent: space-between */}
        <View style={styles.actions}>
          <Button
            label={`Build my ${selectedOption.label} plan  →`}
            onPress={() => router.push(Routes.REGISTER)}
            variant="primary"
            style={styles.ctaAccent}
            textStyle={{ color: Colors.primary }}
          />

          <Pressable
            style={styles.secondaryRow}
            onPress={() => router.push(Routes.LOGIN)}
            hitSlop={8}
          >
            <Text style={styles.secondaryText}>
              Already have an account? <Text style={styles.secondaryLink}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    // Pushes Actions (the 2nd flex child below — `circle` is absolutely
    // positioned, so it's excluded from this entirely) to the bottom of the
    // screen when the top content doesn't fill it. On a short/tall-content
    // screen where scrolling actually kicks in, this has no extra space to
    // distribute, so it falls back to normal top-to-bottom stacking with no
    // artificial gap — exactly the scrollable fallback ScreenWrapper's
    // `scroll` prop is already set up for.
    justifyContent: "space-between",
  },
  circle: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "#5dcaa512",
    top: -100,
    right: -100,
  },
  logoMark: {
    width: 44,
    height: 44,
    marginBottom: Spacing.lg,
  },
  headline: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.white,
    lineHeight: 39,
    marginBottom: Spacing.md,
  },
  sub: {
    ...Typography.body,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "47%",
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: 14,
  },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
  },
  cardDesc: {
    fontSize: 11.5,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  actions: {
    gap: 14,
    alignItems: "center",
    // A guaranteed minimum gap above Actions even when there's no slack left
    // to distribute (i.e. once scrolling actually kicks in on a short
    // screen) — space-between above adds whatever extra room exists on top
    // of this, it doesn't replace it.
    marginTop: Spacing.lg,
  },
  ctaAccent: {
    width: "100%",
    backgroundColor: Colors.accent,
  },
  secondaryRow: {
    paddingVertical: 4,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  secondaryLink: {
    color: Colors.white,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
