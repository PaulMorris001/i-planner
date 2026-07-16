import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseTimeToMinutes } from '@/utils/time';

// Local, on-device scheduling via expo-notifications — no backend involvement.
// Shared by Tasks and Classes: each gets two notifications per occurrence — one
// REMINDER_LEAD_MINUTES before, one exactly at the due/start time.
const REMINDER_LEAD_MINUTES = 15;
const ANDROID_CHANNEL_ID = 'planner-reminders';

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
    name: 'Reminders',
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

// hour/minute of (time - leadMinutes), wrapped into a valid 24h range, plus how
// many days that wrap pushed the notification back (0 or -1) — a due/start time
// early in the morning can push it into the previous day/weekday.
function leadHourMinute(time: string, leadMinutes: number): { hour: number; minute: number; dayShift: 0 | -1 } {
  const raw = parseTimeToMinutes(time) - leadMinutes;
  const wrapped = ((raw % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60, dayShift: raw < 0 ? -1 : 0 };
}

type RecurFreq = 'weekly' | 'weekdays' | 'daily' | 'monthly';

interface OccurrenceSpec {
  title: string;
  bodyForMinutes: (minutesUntil: number) => string;
  dateIso: string;
  time: string;
  recurring: boolean;
  freq?: RecurFreq;
  dayIdxs?: number[];
  leadMinutes: number;
}

// Schedules a single lead-time notification (0 minutes = exactly at the due/
// start time) and returns the resulting id(s). Mirrors
// utils/appleCalendarSync.ts's recurrence handling: weekly/weekdays get one
// native WEEKLY trigger per dayIdxs entry (hence the array return), daily gets a
// single DAILY trigger, monthly a single MONTHLY trigger, everything else a
// single one-off DATE trigger.
async function scheduleOccurrence(spec: OccurrenceSpec): Promise<string[]> {
  if (!spec.dateIso || !spec.time) return [];
  if (parseTimeToMinutes(spec.time) >= 24 * 60) return []; // unparseable time string
  if (!(await hasPermission())) return [];

  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined;

  try {
    if (spec.recurring && spec.freq === 'daily') {
      const { hour, minute } = leadHourMinute(spec.time, spec.leadMinutes);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId },
      });
      return [id];
    }

    if (spec.recurring && (spec.freq === 'weekly' || spec.freq === 'weekdays') && spec.dayIdxs?.length) {
      const { hour, minute, dayShift } = leadHourMinute(spec.time, spec.leadMinutes);
      const ids: string[] = [];
      for (const dayIdx of spec.dayIdxs) {
        const weekday = toExpoWeekday((dayIdx + dayShift + 7) % 7);
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes) },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId },
          })
        );
      }
      return ids;
    }

    if (spec.recurring && spec.freq === 'monthly') {
      const { hour, minute } = leadHourMinute(spec.time, spec.leadMinutes);
      const day = new Date(spec.dateIso).getDate();
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour, minute, channelId },
      });
      return [id];
    }

    // One-off. If the ideal lead moment has already passed (created/edited with
    // under leadMinutes of lead time) but the due/start time itself is still
    // ahead, fire almost immediately instead — a short heads-up beats silently
    // scheduling nothing. For leadMinutes=0 this never triggers, since the ideal
    // moment IS the due time, already guaranteed to be in the future below.
    const minutes = parseTimeToMinutes(spec.time);
    const due = new Date(spec.dateIso);
    due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (due.getTime() <= Date.now()) return []; // already passed — nothing to notify about

    const idealFireAt = new Date(due.getTime() - spec.leadMinutes * 60_000);
    const fireAt = idealFireAt.getTime() > Date.now() ? idealFireAt : new Date(Date.now() + 3_000);
    const minutesUntil = Math.round((due.getTime() - fireAt.getTime()) / 60_000);

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: spec.title, body: spec.bodyForMinutes(minutesUntil) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId },
    });
    return [id];
  } catch (err) {
    console.error('[notifications] failed to schedule', err);
    return [];
  }
}

function dueBody(minutesUntil: number): string {
  return minutesUntil >= 1 ? `Due in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}` : 'Due now';
}

function startBody(minutesUntil: number): string {
  return minutesUntil >= 1 ? `Starting in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}` : 'Starting now';
}

export async function scheduleTaskNotifications(task: {
  title: string;
  dueDate: string;
  time: string;
  recurring: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
}): Promise<string[]> {
  const spec = (leadMinutes: number): OccurrenceSpec => ({
    title: `Task: ${task.title}`,
    bodyForMinutes: dueBody,
    dateIso: task.dueDate,
    time: task.time,
    recurring: task.recurring,
    freq: task.freq,
    dayIdxs: task.dayIdxs,
    leadMinutes,
  });
  const [lead, exact] = await Promise.all([
    scheduleOccurrence(spec(REMINDER_LEAD_MINUTES)),
    scheduleOccurrence(spec(0)),
  ]);
  return [...lead, ...exact];
}

export async function scheduleClassNotifications(item: {
  courseName: string;
  startDate: string;
  time: string;
  recurring: boolean;
  freq: RecurFreq;
  dayIdxs: number[];
}): Promise<string[]> {
  const spec = (leadMinutes: number): OccurrenceSpec => ({
    title: `Class: ${item.courseName}`,
    bodyForMinutes: startBody,
    dateIso: item.startDate,
    time: item.time,
    recurring: item.recurring,
    freq: item.freq,
    dayIdxs: item.dayIdxs,
    leadMinutes,
  });
  const [lead, exact] = await Promise.all([
    scheduleOccurrence(spec(REMINDER_LEAD_MINUTES)),
    scheduleOccurrence(spec(0)),
  ]);
  return [...lead, ...exact];
}

export async function cancelNotifications(notificationIds: string[] | undefined): Promise<void> {
  if (!notificationIds?.length) return;
  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Already fired/cancelled — safe to ignore.
    }
  }
}
