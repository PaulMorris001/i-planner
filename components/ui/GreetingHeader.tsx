import { IconSymbol } from "@/components/ui/icon-symbol";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Colors, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface GreetingHeaderProps {
  greeting?: string;
  name?: string;
  // Only the home page wires this up — elsewhere the menu button stays hidden.
  // Opens the profile side-drawer (see ProfileInfoModal).
  onMenuPress?: () => void;
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
  onMenuPress,
}: GreetingHeaderProps) {
  const { user, initializing } = useAuth();
  // Only show a skeleton when actually waiting on auth with no explicit override.
  const nameLoading = initializing && !name;

  const firstName = user?.fullName?.trim().split(/\s+/)[0];

  const displayGreeting = greeting ?? getTimeBasedGreeting();
  // "||" not "??" — AuthContext stores fullName as '' when Firebase's displayName is null,
  // and "??" wouldn't catch that empty string.
  const displayName = name || firstName || user?.email?.split("@")[0] || "";

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
      {onMenuPress && (
        <Pressable style={styles.menuButton} onPress={onMenuPress} hitSlop={8}>
          <IconSymbol name="line.3.horizontal" color={Colors.textPrimary} size={22} />
        </Pressable>
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
  // Same 42x42 footprint the old circular avatar had, so the header's height
  // doesn't shift now that it's a menu trigger instead of a user badge.
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
});
