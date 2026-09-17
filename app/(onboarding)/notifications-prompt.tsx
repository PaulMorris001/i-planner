import { useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";
import { useSettings } from "@/hooks/useSettings";

// Shown right after a fresh sign-up/sign-in (see register.tsx and login.tsx's
// "not yet onboarded" branch) — before Focus, so notification permission is
// asked while the user is still mid-setup rather than left undiscoverable
// behind a Profile & Settings toggle they might never find.
//
// Also re-shown to an *already-onboarded* returning account when this
// specific device's OS notification permission is still undetermined (a
// delete-and-reinstall wipes that even though the account itself already
// finished onboarding — see login.tsx) — `next=dashboard` distinguishes that
// case so it lands back on Dashboard instead of re-running Focus, which a
// returning user has already been through and shouldn't see again.
export default function NotificationsPrompt() {
  const { enableReminders } = useSettings();
  const [requesting, setRequesting] = useState(false);
  const { next } = useLocalSearchParams<{ next?: string }>();

  const proceed = () => router.replace(next === 'dashboard' ? Routes.DASHBOARD : Routes.FOCUS);

  const handleEnable = async () => {
    setRequesting(true);
    const ok = await enableReminders();
    setRequesting(false);
    if (!ok) {
      Alert.alert(
        "Couldn't enable reminders",
        "Notification permission was denied. You can allow it later from Profile & Settings or your device settings.",
      );
    }
    proceed();
  };

  return (
    <ScreenWrapper backgroundColor={Colors.white}>
      <View style={styles.root}>
        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <IconSymbol name="bell.fill" color={Colors.primaryLight} size={30} />
          </View>
          <Text style={styles.headline}>Never miss a deadline</Text>
          <Text style={styles.sub}>
            Turn on reminders and we’ll notify you 15 minutes before — and right when — a task, class, or
            bill is due. You can change this any time in Profile & Settings.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={requesting ? "Requesting…" : "Enable notifications"}
            onPress={handleEnable}
            loading={requesting}
            style={styles.cta}
          />
          <Pressable onPress={proceed} hitSlop={8} disabled={requesting}>
            <Text style={styles.skipText}>Not now</Text>
          </Pressable>
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
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.infoSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  headline: {
    ...Typography.h1,
    fontSize: 26,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sub: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  actions: {
    gap: 12,
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  cta: {
    width: "100%",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
    paddingVertical: 8,
  },
});
