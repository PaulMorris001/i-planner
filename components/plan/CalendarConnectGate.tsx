import { Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GateCard } from '@/components/ui/GateCard';
import { Colors } from '@/constants/theme';

interface CalendarConnectGateProps {
  onConnectApple: () => void;
  onConnectGoogle: () => void;
  onSkip: () => void;
}

export function CalendarConnectGate({ onConnectApple, onConnectGoogle, onSkip }: CalendarConnectGateProps) {
  return (
    <GateCard
      icon="calendar"
      title="Connect your calendar"
      subtitle="Sync events so your AI Coach plans around what's already on your schedule."
    >
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
    </GateCard>
  );
}

const styles = StyleSheet.create({
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
