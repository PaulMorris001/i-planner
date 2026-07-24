import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";

const PILLS = ["Time", "Learning", "Career", "Money"];

export default function Welcome() {
  return (
    <ScreenWrapper backgroundColor={Colors.primary}>
      <View style={styles.root}>
        {/* Decorative circle */}
        <View style={styles.circle} />

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>i</Text>
          </View>

          <Badge label="I-planner" variant="accent" style={styles.badge} />

          <Text style={styles.headline}>
            Your academic{"\n"}life, organised.
          </Text>

          <Text style={styles.sub}>
            Turns scattered goals into structured plans and daily action.
          </Text>

          {/* Feature pills */}
          <View style={styles.pills}>
            {PILLS.map((pill) => (
              <View key={pill} style={styles.pill}>
                <Text style={styles.pillText}>{pill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="Get started"
            onPress={() => router.push(Routes.REGISTER)}
            variant="primary"
            style={styles.ctaAccent}
            textStyle={{ color: Colors.primary }}
          />

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push(Routes.LOGIN)}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
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
  hero: {
    flex: 1,
    justifyContent: "center",
    paddingTop: Spacing.xxl,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    lineHeight: 34,
  },
  badge: {
    marginBottom: Spacing.md,
  },
  headline: {
    fontSize: 38,
    fontWeight: "700",
    color: Colors.white,
    lineHeight: 46,
    marginBottom: Spacing.md,
  },
  sub: {
    ...Typography.body,
    color: "rgba(255,255,255,0.6)",
    maxWidth: 300,
    lineHeight: 24,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: Spacing.md,
  },
  pill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
  },
  actions: {
    gap: 12,
    paddingBottom: Spacing.xl,
  },
  ctaAccent: {
    backgroundColor: Colors.accent,
  },
  secondaryBtn: {
    height: 54,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
  },
});
