import { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useTasks } from '@/hooks/useTasks';
import { usePlan } from '@/hooks/usePlan';
import { snoozeAlarm, ALARM_SNOOZE_MINUTES, formatMinutes, type AlarmKind } from '@/utils/notifications';
import { formatTimeLabel } from '@/utils/date';

const SNOOZE_MINUTES = ALARM_SNOOZE_MINUTES;

// Reached only via registerAlarmNotificationRouting (utils/notifications.ts)
// when the user taps an alarm-flagged task or class notification — never
// linked from anywhere in the UI. Deliberately skips ScreenWrapper's usual
// header/back-button chrome for a bespoke, urgent full-bleed presentation.
export default function AlarmRinging() {
  const { kind: kindParam, id, title: paramTitle } = useLocalSearchParams<{
    kind?: string;
    id?: string;
    title?: string;
  }>();
  // Defaults to task-alarm — covers an already-scheduled notification from
  // before this screen learned about classes, which won't carry a kind param.
  const kind: AlarmKind = kindParam === 'class-alarm' ? 'class-alarm' : 'task-alarm';
  const { tasks } = useTasks();
  const { plan } = usePlan();
  const [snoozing, setSnoozing] = useState(false);

  // The live task/class is only ever an enhancement, never required — see
  // utils/notifications.ts's scheduleTaskNotifications doc comment for why a
  // brand-new entity's alarm can't always carry a resolvable id yet.
  const liveTitle =
    kind === 'task-alarm'
      ? tasks.find((t) => t.id === id)?.title
      : plan.classes.find((c) => c.id === id)?.courseName;
  const title = liveTitle || paramTitle || (kind === 'task-alarm' ? 'Task' : 'Class');

  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(Routes.DASHBOARD);
    }
  };

  const handleSnooze = async () => {
    setSnoozing(true);
    try {
      await snoozeAlarm(kind, { id: id || undefined, title }, SNOOZE_MINUTES);
      dismiss();
      Alert.alert('Snoozed', `We'll remind you again in ${formatMinutes(SNOOZE_MINUTES)}.`);
    } catch (err) {
      console.error('[AlarmRinging] failed to snooze', err);
      Alert.alert("Couldn't snooze", 'Check your connection and try again.');
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <ScreenWrapper backgroundColor={Colors.primary}>
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.iconBadge}>
            <IconSymbol name="bell.fill" color={Colors.error} size={34} />
          </View>
          <Text style={styles.eyebrow}>ALARM</Text>
          <Text style={styles.title} numberOfLines={3}>{title}</Text>
          <Text style={styles.time}>{formatTimeLabel(new Date())}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.stopBtn} onPress={dismiss}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
          <Pressable style={styles.snoozeBtn} onPress={handleSnooze} disabled={snoozing}>
            <Text style={styles.snoozeBtnText}>
              {snoozing ? 'Snoozing…' : `Snooze ${SNOOZE_MINUTES} min`}
            </Text>
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
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(226,75,74,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.error,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 36,
  },
  time: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
  },
  actions: {
    gap: 12,
    paddingBottom: Spacing.xl,
  },
  stopBtn: {
    height: 58,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
  },
  stopBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  snoozeBtn: {
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  snoozeBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
});
