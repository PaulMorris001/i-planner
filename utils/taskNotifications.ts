import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseTimeToMinutes } from '@/utils/time';
import type { TaskFrequency } from '@/types/task.types';

// Local, on-device scheduling via expo-notifications — no backend involvement.
// A reminder fires this many minutes before the task's due time.
const REMINDER_LEAD_MINUTES = 15;
const ANDROID_CHANNEL_ID = 'task-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Task reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return result.granted;
}

async function hasPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

// Monday-start dayIdx (0=Mon..6=Sun) -> expo-notifications' WeeklyTriggerInput
// weekday (1=Sun..7=Sat).
function toExpoWeekday(dayIdx: number): number {
  return ((dayIdx + 1) % 7) + 1;
}

// hour/minute of (time - REMINDER_LEAD_MINUTES), wrapped into a valid 24h range,
// plus how many days that wrap pushed the reminder back (0 or -1) — a due time
// early in the morning can push the reminder into the previous day/weekday.
function leadHourMinute(time: string): { hour: number; minute: number; dayShift: 0 | -1 } {
  const raw = parseTimeToMinutes(time) - REMINDER_LEAD_MINUTES;
  const wrapped = ((raw % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60, dayShift: raw < 0 ? -1 : 0 };
}

interface ReminderInput {
  title: string;
  dueDate: string;
  time: string;
  recurring: boolean;
  freq?: TaskFrequency;
  dayIdxs?: number[];
}

const REMINDER_BODY = `Due in ${REMINDER_LEAD_MINUTES} minutes`;

// Schedules the reminder(s) for a task and returns the resulting notification
// id(s). Requires both a due date and a time (per the "due date and time" scope
// of this feature) — a task with only a date has no specific moment to count
// backwards from. Mirrors utils/appleCalendarSync.ts's recurrence handling:
// weekly/weekdays get one native WEEKLY trigger per dayIdxs entry (hence the
// array return), daily gets a single native DAILY trigger, everything else gets
// a single one-off DATE trigger.
export async function scheduleTaskReminders(task: ReminderInput): Promise<string[]> {
  if (!task.dueDate || !task.time) return [];
  if (parseTimeToMinutes(task.time) >= 24 * 60) return []; // unparseable time string
  if (!(await hasPermission())) return [];

  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined;

  try {
    if (task.recurring && task.freq === 'daily') {
      const { hour, minute } = leadHourMinute(task.time);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: task.title, body: REMINDER_BODY },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId },
      });
      return [id];
    }

    if (task.recurring && (task.freq === 'weekly' || task.freq === 'weekdays') && task.dayIdxs?.length) {
      const { hour, minute, dayShift } = leadHourMinute(task.time);
      const ids: string[] = [];
      for (const dayIdx of task.dayIdxs) {
        const weekday = toExpoWeekday((dayIdx + dayShift + 7) % 7);
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content: { title: task.title, body: REMINDER_BODY },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId },
          })
        );
      }
      return ids;
    }

    // One-off: reminder 15 minutes before the due date/time. If that ideal
    // moment has already passed (the task was created/edited with under 15
    // minutes of lead time) but the due time itself is still ahead, fire almost
    // immediately instead — a short heads-up beats silently scheduling nothing.
    const minutes = parseTimeToMinutes(task.time);
    const due = new Date(task.dueDate);
    due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (due.getTime() <= Date.now()) return []; // already overdue — nothing to remind about

    const idealFireAt = new Date(due.getTime() - REMINDER_LEAD_MINUTES * 60_000);
    const fireAt = idealFireAt.getTime() > Date.now() ? idealFireAt : new Date(Date.now() + 3_000);
    const minutesUntilDue = Math.round((due.getTime() - fireAt.getTime()) / 60_000);
    const body = minutesUntilDue >= 1 ? `Due in ${minutesUntilDue} minute${minutesUntilDue === 1 ? '' : 's'}` : 'Due now';

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: task.title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId },
    });
    return [id];
  } catch (err) {
    console.error('[taskNotifications] failed to schedule reminder', err);
    return [];
  }
}

export async function cancelTaskReminders(notificationIds: string[] | undefined): Promise<void> {
  if (!notificationIds?.length) return;
  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Already fired/cancelled — safe to ignore.
    }
  }
}
