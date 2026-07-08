import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface GreetingHeaderProps {
  greeting?: string;
  name?: string;
  avatarInitial?: string;
}

export function GreetingHeader({ greeting = 'Good morning,', name, avatarInitial }: GreetingHeaderProps) {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const initial = user?.fullName?.trim().charAt(0).toUpperCase();

  const displayName = name ?? firstName ?? 'Jordan';
  const displayInitial = avatarInitial ?? initial ?? 'J';

  return (
    <View style={styles.header}>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.name}>{displayName}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{displayInitial}</Text>
      </View>
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
