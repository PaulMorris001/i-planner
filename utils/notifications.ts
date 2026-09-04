import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { parseTimeToMinutes } from '@/utils/time';
import { parseISODateLocal, toDateKey, formatTimeLabel } from '@/utils/date';
import { Routes } from '@/constants/routes';

// Local, on-device scheduling via expo-notifications — no backend involvement.
// Shared by Tasks and Classes: each gets two notifications per occurrence — one
// REMINDER_LEAD_MINUTES before, one exactly at the due/start time.
const REMINDER_LEAD_MINUTES = 15;
const ANDROID_CHANNEL_ID = 'planner-reminders';
// Separate channel, not a change to the one above — Android channel settings
// are effectively fixed once created, and this must not retroactively change
// behavior for every existing non-alarm task/class/bill reminder already
// relying on 'planner-reminders'.
const ANDROID_ALARM_CHANNEL_ID = 'planner-alarms';

let handlerRegistered = false;

// Registers expo-notifications' foreground handler — a native event-listener
// call, so it's deliberately deferred to run from an effect after first mount
// (see app/_layout.tsx) rather than at module-import time, which runs before
// React (and the native bridge) has finished its own startup sequence.
export function initNotificationHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Routes a tapped alarm-task notification to the in-app Alarm screen —
// covers both cases expo-notifications distinguishes: the app already
// running/backgrounded (the listener fires immediately) and a fully cold
// start caused by the tap (nothing is listening yet, so the response has to
// be read back once via getLastNotificationResponseAsync instead). Call once
// from app/_layout.tsx's startup effect, alongside initNotificationHandler.
export function registerAlarmNotificationRouting(): () => void {
  const routeIfAlarm = (data: Record<string, unknown> | undefined) => {
    if (data?.kind !== 'task-alarm') return;
    router.push({
      pathname: Routes.ALARM_RINGING,
      params: { taskId: String(data.taskId ?? ''), title: String(data.title ?? '') },
    });
  };

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      routeIfAlarm(response.notification.request.content.data);
      // Consumed — without this, reopening the app later (even from the home
      // screen icon, not the notification) would re-trigger this same route.
      Notifications.clearLastNotificationResponseAsync();
    })
    .catch((err) => console.error('[notifications] failed to read last response', err));

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    routeIfAlarm(response.notification.request.content.data);
  });
  return () => subscription.remove();
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// Louder/harder-to-miss variant for a task's Alarm toggle — MAX importance
// plus bypassDnd, which Android allows an app to request without special
// permission (the user can still turn it off per-app in system settings).
async function ensureAndroidAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_ALARM_CHANNEL_ID, {
    name: 'Alarms',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    // 'default' for now — swap for a bundled custom alarm tone (via the
    // expo-notifications plugin's `sounds` config) once one exists.
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  await ensureAndroidAlarmChannel();
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
  // Louder/harder-to-miss delivery — custom sound, bypasses Do Not Disturb
  // (Android channel) / breaks through Focus modes (iOS timeSensitive).
  // Not a full lock-screen takeover (that needs Apple's restricted Critical
  // Alerts entitlement, not used here).
  isAlarm?: boolean;
  // Read back in registerAlarmNotificationRouting when the user taps the
  // notification — currently only set for alarm task notifications
  // (kind: 'task-alarm'), routing to the in-app Alarm screen.
  data?: Record<string, unknown>;
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

  const channelId = Platform.OS === 'android'
    ? (spec.isAlarm ? ANDROID_ALARM_CHANNEL_ID : ANDROID_CHANNEL_ID)
    : undefined;
  // iOS-only fields; harmless no-ops on Android (channelId above is what
  // actually controls Android's sound/DND behavior, via the channel itself).
  const alarmContentExtras = spec.isAlarm
    ? { sound: true as const, interruptionLevel: 'timeSensitive' as const }
    : {};

  try {
    if (spec.recurring && spec.freq === 'daily') {
      const { hour, minute } = leadHourMinute(spec.time, spec.leadMinutes);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes), ...alarmContentExtras, data: spec.data },
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
            content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes), ...alarmContentExtras, data: spec.data },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId },
          })
        );
      }
      return ids;
    }

    if (spec.recurring && spec.freq === 'monthly') {
      const { hour, minute } = leadHourMinute(spec.time, spec.leadMinutes);
      const day = parseISODateLocal(spec.dateIso).getDate();
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.bodyForMinutes(spec.leadMinutes), ...alarmContentExtras, data: spec.data },
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
    const due = parseISODateLocal(spec.dateIso);
    due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (due.getTime() <= Date.now()) return []; // already passed — nothing to notify about

    const idealFireAt = new Date(due.getTime() - spec.leadMinutes * 60_000);
    const fireAt = idealFireAt.getTime() > Date.now() ? idealFireAt : new Date(Date.now() + 3_000);
    const minutesUntil = Math.round((due.getTime() - fireAt.getTime()) / 60_000);

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: spec.title, body: spec.bodyForMinutes(minutesUntil), ...alarmContentExtras, data: spec.data },
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
  // Absent when scheduling for a brand-new task — TasksContext.createTask
  // calls this before the backend assigns a real id (only a throwaway,
  // never-persisted tempId exists at that point). When absent, the alarm
  // notification's data simply omits taskId — the Alarm screen still shows
  // and functions from the embedded title alone; a live task lookup starts
  // working the first time this task is ever edited (updateTask always has
  // the real id by then).
  id?: string;
  title: string;
  dueDate: string;
  time: string;
  recurring: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  alarmEnabled?: boolean;
}): Promise<string[]> {
  // Only the due-time notification (leadMinutes: 0) ever gets isAlarm — the
  // 15-min lead stays a normal, gentle heads-up either way, regardless of
  // the Alarm toggle. Set per-call below, not in this shared spec factory.
  const spec = (leadMinutes: number, isAlarm?: boolean): OccurrenceSpec => ({
    title: `Task: ${task.title}`,
    bodyForMinutes: dueBody,
    dateIso: task.dueDate,
    time: task.time,
    recurring: task.recurring,
    freq: task.freq,
    dayIdxs: task.dayIdxs,
    leadMinutes,
    isAlarm,
    data: isAlarm ? { kind: 'task-alarm', taskId: task.id, title: task.title } : undefined,
  });
  const [lead, exact] = await Promise.all([
    scheduleOccurrence(spec(REMINDER_LEAD_MINUTES)),
    scheduleOccurrence(spec(0, task.alarmEnabled)),
  ]);
  return [...lead, ...exact];
}

// Fired from the Alarm screen's "Snooze" button — a single one-off alarm
// notification "minutes" from now. Not persisted onto the task's
// notificationIds: it's short-lived and self-consuming, not worth a round
// trip to track for cancellation the way the real due-time notification is.
export async function snoozeTaskAlarm(task: { id?: string; title: string }, minutes: number): Promise<string[]> {
  const fireAt = new Date(Date.now() + minutes * 60_000);
  return scheduleOccurrence({
    title: `Task: ${task.title}`,
    bodyForMinutes: dueBody,
    dateIso: toDateKey(fireAt),
    time: formatTimeLabel(fireAt),
    recurring: false,
    leadMinutes: 0,
    isAlarm: true,
    data: { kind: 'task-alarm', taskId: task.id, title: task.title },
  });
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

// Bills have no time-of-day field (the form only has a date picker) — fire at a
// fixed, reasonable morning time for every bill reminder.
const BILL_WEEK_LEAD_DAYS = 7;
const BILL_LEAD_DAYS = 3;
const BILL_TIME = '9:00 AM';

// Whether a one-off lead reminder's ideal fire moment (due date/time minus
// leadMinutes) has already passed as of right now — mirrors the same
// due/idealFireAt math scheduleOccurrence's one-off branch does internally,
// so a bill's week/3-day lead can be checked *before* ever calling it.
function leadAlreadyPassed(dueDateIso: string, time: string, leadMinutes: number): boolean {
  const minutes = parseTimeToMinutes(time);
  const due = parseISODateLocal(dueDateIso);
  due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return due.getTime() - leadMinutes * 60_000 <= Date.now();
}

export async function scheduleBillNotifications(bill: {
  name: string;
  amount: number;
  dueDate: string;
  recurring: boolean;
}): Promise<string[]> {
  // "in 1 week" reads better than "in 7 days"; everything else stays a plain
  // day count. Shared by both lead reminders — which nominal lead scheduled it
  // only matters for the days-remaining number this produces.
  const daysAwayBody = (days: number) => {
    if (days <= 0) return `${bill.name} is due today — $${bill.amount}`;
    if (days >= 6) return `${bill.name} is due in 1 week — $${bill.amount}`;
    return `${bill.name} is due in ${days} day${days === 1 ? '' : 's'} — $${bill.amount}`;
  };
  const dueBodyText = () => `${bill.name} is due today — $${bill.amount}`;

  if (!bill.recurring) {
    // scheduleOccurrence's one-off path already operates on full Date timestamps,
    // so a day-based lead is just leadMinutes = days * 24 * 60 — no changes needed
    // there. Its own "already passed" fallback fires almost immediately instead of
    // skipping — the right call for a 15-minute task reminder, but not for a
    // week/3-day-before bill reminder (getting one seconds after creating a bill
    // due tomorrow reads as noise, not a heads-up) — so each lead is checked with
    // leadAlreadyPassed *before* calling scheduleOccurrence, and simply skipped
    // (never scheduled) rather than falling into that fallback. The due-date
    // notification is scheduled as its own independent call either way — it never
    // depends on whether a lead applied, so it always fires correctly even when
    // both leads are skipped for a bill due very soon.
    const oneOffLeadBody = (minutesUntil: number) => daysAwayBody(Math.round(minutesUntil / (24 * 60)));
    const spec = (leadMinutes: number, bodyForMinutes: (minutesUntil: number) => string): OccurrenceSpec => ({
      title: `Bill: ${bill.name}`,
      bodyForMinutes,
      dateIso: bill.dueDate,
      time: BILL_TIME,
      recurring: false,
      leadMinutes,
    });
    const scheduleLead = (days: number) => {
      const leadMinutes = days * 24 * 60;
      if (leadAlreadyPassed(bill.dueDate, BILL_TIME, leadMinutes)) return Promise.resolve([]);
      return scheduleOccurrence(spec(leadMinutes, oneOffLeadBody));
    };
    const [weekLead, threeDayLead, due] = await Promise.all([
      scheduleLead(BILL_WEEK_LEAD_DAYS),
      scheduleLead(BILL_LEAD_DAYS),
      scheduleOccurrence(spec(0, dueBodyText)),
    ]);
    return [...weekLead, ...threeDayLead, ...due];
  }

  // Recurring monthly. The due-date reminder reuses the exact day-of-month
  // unmodified — a native MONTHLY trigger always resolves to its next real
  // occurrence (this month or, if that day already passed, next month), so it
  // fires correctly regardless of how soon the next due date is; no "already
  // passed" check applies to it. A perfectly accurate "N days before this
  // recurring day, every month" isn't expressible as one native MONTHLY trigger
  // either (months vary in length), so each lead reminder uses a synthetic
  // dateIso with its day shifted back by N days (clamped to 1) —
  // scheduleOccurrence's monthly path only reads the day-of-month out of
  // dateIso, so this reuses it unmodified. Same class of approximation as
  // monthsUntil's 30.44-day average month elsewhere in this app — good enough
  // for a reminder, not exact every month. If a shifted lead day happens to
  // land on/after today it just fires this month like normal; if it's already
  // this month's past, the native trigger rolls it to next month on its own —
  // either way nothing here needs to special-case a "too soon to lead" bill.
  const due = parseISODateLocal(bill.dueDate);
  const dueDay = due.getDate();
  const dateIsoForDay = (day: number) =>
    `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthlySpec = (dateIso: string, bodyForMinutes: () => string): OccurrenceSpec => ({
    title: `Bill: ${bill.name}`,
    bodyForMinutes,
    dateIso,
    time: BILL_TIME,
    recurring: true,
    freq: 'monthly',
    leadMinutes: 0,
  });

  // A bill due early in the month leaves no room for a full week/3-day lead
  // before day 1 — the Math.max clamp above pushes the trigger day forward
  // instead, which can land it on the due day itself, or put both leads on the
  // same day as each other. Naively keeping the nominal "in 7 days"/"in 3
  // days" text in that case would be wrong (the real gap could be much
  // shorter), and firing two same-day duplicates is just noise — so each
  // lead's message is built from its *actual* day gap after clamping, and
  // it's dropped entirely once that gap no longer exceeds a shorter lead
  // already covers (minGapDays): the 3-day lead needs at least 1 real day of
  // lead time to mean anything, and the week lead is only worth keeping
  // alongside the 3-day one if it's genuinely further out.
  const scheduleLead = (leadDay: number, minGapDays: number) => {
    const actualGapDays = dueDay - leadDay;
    if (actualGapDays <= minGapDays) return Promise.resolve<string[]>([]);
    return scheduleOccurrence(monthlySpec(dateIsoForDay(leadDay), () => daysAwayBody(actualGapDays)));
  };

  const [weekLead, threeDayLead, dueIds] = await Promise.all([
    scheduleLead(Math.max(1, dueDay - BILL_WEEK_LEAD_DAYS), BILL_LEAD_DAYS),
    scheduleLead(Math.max(1, dueDay - BILL_LEAD_DAYS), 0),
    scheduleOccurrence(monthlySpec(bill.dueDate, dueBodyText)),
  ]);
  return [...weekLead, ...threeDayLead, ...dueIds];
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
