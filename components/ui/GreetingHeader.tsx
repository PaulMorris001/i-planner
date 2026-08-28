import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface GreetingHeaderProps {
  greeting?: string;
  name?: string;
  avatarInitial?: string;
  // Only the home page wires this up — elsewhere the avatar stays a plain,
  // non-interactive badge.
  onAvatarPress?: () => void;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

export function GreetingHeader({
  greeting,
  name,
  avatarInitial,
  onAvatarPress,
}: GreetingHeaderProps) {
  const { user, initializing } = useAuth();
  // Only show a skeleton when actually waiting on auth with no explicit override.
  const nameLoading = initializing && !name;
  const avatarLoading = initializing && !avatarInitial;

  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const initial = user?.fullName?.trim().charAt(0).toUpperCase();
  const emailInitial = user?.email
    ? user.email.trim().charAt(0).toUpperCase()
    : undefined;

  const displayGreeting = greeting ?? getTimeBasedGreeting();
  // "||" not "??" — AuthContext stores fullName as '' when Firebase's displayName is null,
  // and "??" wouldn't catch that empty string.
  const displayName = name || firstName || user?.email?.split("@")[0] || "";
  const displayInitial = avatarInitial || initial || emailInitial || "J";

  const avatar = avatarLoading ? (
    <SkeletonBlock width={42} height={42} borderRadius={21} />
  ) : (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{displayInitial}</Text>
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.greeting}>{displayGreeting}</Text>
        {nameLoading ? (
          <SkeletonBlock
            width={130}
            height={23}
            borderRadius={6}
            style={{ marginTop: 3 }}
          />
        ) : (
          <Text style={styles.name}>{displayName}</Text>
        )}
      </View>
      {onAvatarPress && !avatarLoading ? (
        <Pressable onPress={onAvatarPress} hitSlop={6}>
          {avatar}
        </Pressable>
      ) : (
        avatar
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  greeting: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  name: {
    fontSize: 23,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.success,
  },
});
