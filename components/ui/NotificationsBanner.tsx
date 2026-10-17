import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { Colors, Spacing, Radius } from '@/constants/theme';

const SNOOZE_KEY = 'notifications-banner-snoozed-until';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

// A gentle nudge on the dashboard while this phone can't show notifications. "Not now" hides it
// for a few days; it disappears for good as soon as notifications are on.
export function NotificationsBanner() {
  const { permission, turnOn } = useNotificationPermission();
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SNOOZE_KEY)
      .then((value) => setSnoozed(!!value && Number(value) > Date.now()))
      .catch(() => setSnoozed(false));
  }, []);

  if (snoozed || permission === 'granted' || permission === 'unknown') return null;

  const snooze = () => {
    setSnoozed(true);
    AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)).catch(() => undefined);
  };

  const denied = permission === 'denied';
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <IconSymbol name="bell.fill" color={Colors.primaryLight} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Turn on notifications</Text>
        <Text style={styles.sub}>
          {denied
            ? 'They are off for i-Planner on this phone, so reminders and alarms can’t reach you. Switch them on in Settings.'
            : 'Get a reminder before a task, class or bill is due.'}
        </Text>
        <View style={styles.row}>
          <Pressable onPress={turnOn} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>{denied ? 'Open Settings' : 'Turn on'}</Text>
          </Pressable>
          <Pressable onPress={snooze} hitSlop={8} accessibilityRole="button">
            <Text style={styles.later}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sub: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  primary: { backgroundColor: Colors.primaryLight, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  primaryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  later: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
});
