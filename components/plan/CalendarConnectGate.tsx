import { View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';

interface CalendarConnectGateProps {
  onConnectApple: () => void;
  onConnectGoogle: () => void;
  onSkip: () => void;
}

export function CalendarConnectGate({ onConnectApple, onConnectGoogle, onSkip }: CalendarConnectGateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <IconSymbol name="calendar" color={Colors.primaryLight} size={26} />
        </View>

        <Text style={styles.title}>Connect your calendar</Text>
        <Text style={styles.subtitle}>
          Sync events so your AI Coach plans around what's already on your schedule.
        </Text>

        <Pressable style={styles.googleBtn} onPress={onConnectGoogle}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleBtnText}>Connect Google Calendar</Text>
        </Pressable>

        <Pressable style={styles.appleBtn} onPress={onConnectApple}>
          <IconSymbol name="calendar" color={Colors.textPrimary} size={16} />
          <Text style={styles.appleBtnText}>Connect Apple Calendar</Text>
        </Pressable>

        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: Spacing.lg,
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.textPrimary,
    borderRadius: 13,
    paddingVertical: 14,
    marginBottom: 10,
  },
  googleIcon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
    backgroundColor: Colors.white,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  googleBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.white,
  },
  appleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 14,
    marginBottom: 18,
  },
  appleBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
