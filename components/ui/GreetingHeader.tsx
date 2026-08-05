import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

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
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function GreetingHeader({ greeting, name, avatarInitial, onAvatarPress }: GreetingHeaderProps) {
  const { user, initializing } = useAuth();
  // Only the real un-resolved case (waiting on user, with no explicit
  // override) should show a skeleton — an explicit name/avatarInitial prop
  // doesn't depend on auth at all, so it's fine to show immediately.
  const nameLoading = initializing && !name;
  const avatarLoading = initializing && !avatarInitial;

  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const initial = user?.fullName?.trim().charAt(0).toUpperCase();

  const displayGreeting = greeting ?? getTimeBasedGreeting();
  const displayName = name ?? firstName ?? 'Jordan';
  const displayInitial = avatarInitial ?? initial ?? 'J';

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
          <SkeletonBlock width={130} height={23} borderRadius={6} style={{ marginTop: 3 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  name: {
    fontSize: 23,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
});
