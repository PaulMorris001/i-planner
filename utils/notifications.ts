import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { parseTimeToMinutes } from '@/utils/time';
import { parseISODateLocal } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import { Routes } from '@/constants/routes';
import { taskService } from '@/services/task.service';
import { planService } from '@/services/plan.service';
import type { StudentPlan } from '@/types/plan.types';

// Local, on-device scheduling via expo-notifications — no backend involvement.
// Shared by Tasks and Classes: each gets two notifications per occurrence — one
// REMINDER_LEAD_MINUTES before, one exactly at the due/start time.
const REMINDER_LEAD_MINUTES = 15;
const ANDROID_CHANNEL_ID = 'planner-reminders';
// Separate channel, not a change to the one above — Android channel settings
// are effectively fixed once created, and this must not retroactively change
// behavior for every existing non-alarm task/class/bill reminder already
// relying on 'planner-reminders'.
//
// '-v2' is load-bearing, not cosmetic: per Expo's own docs, "after a channel
// has been created, you can modify only its name and description" — sound is
// locked in permanently at creation (an Android OS limitation, not
// expo-notifications'). This channel first shipped with sound: 'default'
// (before alarm_buzzer.wav existed), so any device that already ran that
// build has a 'planner-alarms' channel permanently stuck on the system
// default tone — setNotificationChannelAsync can update this code's *request*
// all it wants, but Android silently ignores the new sound on the existing
// channel. Bumping the id forces a brand-new channel, created fresh with the
// real alarm tone from the start. Do this again for any future channel
// config change that isn't just name/description.
const ANDROID_ALARM_CHANNEL_ID = 'planner-alarms-v2';

// Notification-level action buttons for an alarm-flagged task or class — lets
// the user snooze/dismiss straight from the notification (lock screen/shade)
// without opening the app. Registered once at startup via ensureAlarmCategory
// below. (Deliberately distinct from the AlarmKind string values below, even
// though 'task-alarm' would coincidentally match one of them — this id is an
// OS-level category identifier, unrelated to which entity kind fired it.)
const ALARM_CATEGORY_ID = 'planner-alarm-actions';
const ALARM_SNOOZE_ACTION_ID = 'ALARM_SNOOZE';
const ALARM_DISMISS_ACTION_ID = 'ALARM_DISMISS';
export const ALARM_SNOOZE_MINUTES = 1;

// "1 minute" / "5 minutes" — shared so the two "We'll remind you again in…"
// messages below (and app/alarm-ringing.tsx's own) can't drift out of sync
// with each other or with ALARM_SNOOZE_MINUTES the way two independently
// hardcoded singular/plural strings just did.
export function formatMinutes(n: number): string {
  return `${n} minute${n === 1 ? '' : 's'}`;
}

// A one-off alarm (a non-recurring task's due-time fire, or any snooze) isn't
// just a single notification — it's a short burst that keeps re-firing a
// couple minutes apart until the user actually acts on one of them, to
// approximate a real alarm "ringing until dismissed" within what a local
// notification can legitimately do (see utils/notifications.ts's isAlarm doc
// comment below for what that excludes). Scoped to one-off alarms only — a
// *recurring* alarm task's native WEEKLY/DAILY/MONTHLY trigger fires once per
// occurrence already and re-fires again next time regardless, and there's no
// way to selectively silence "just this occurrence's" escalations without
// also silencing every future occurrence's, so those stay single-fire (still
// get the loud sound/actions below, just not the repeat burst).
const ALARM_ESCALATION_COUNT = 3;
const ALARM_ESCALATION_INTERVAL_MINUTES = 1;

let handlerRegistered = false;
let alarmCategoryEnsured = false;

// Registers the Snooze/Dismiss action buttons shown on an alarm notification
// itself. Fire-and-forget, idempotent — categories live in the OS's own
// notification framework, not React state, so this just needs to run once
// per app process before any alarm notification is displayed.
function ensureAlarmCategory(): void {
  if (alarmCategoryEnsured) return;
  alarmCategoryEnsured = true;
  Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
    {
      identifier: ALARM_SNOOZE_ACTION_ID,
      buttonTitle: `Snooze ${ALARM_SNOOZE_MINUTES} min`,
      // Guarantees the reschedule actually runs — per expo-notifications' own
      // docs, an action with opensAppToForeground:false can silently no-op on
      // a fully-killed app, which is the one thing a snooze must never do.
      options: { opensAppToForeground: true },
    },
    {
      identifier: ALARM_DISMISS_ACTION_ID,
      buttonTitle: 'Dismiss',
      // Deliberately false, unlike Snooze — dismiss should feel instant, not
      // flash the app open. Accepted tradeoff: per the same expo-notifications
      // caveat above, if the app is fully killed (not just backgrounded) this
      // JS handler may never run, so a burst's remaining escalations could
      // keep ringing after being "dismissed." Android runs the handler even
      // from killed per Expo's docs, so this only bites on iOS, and it's
      // bounded — at most ALARM_ESCALATION_COUNT more re-fires, a few minutes,
      // never indefinite.
      options: { isDestructive: true, opensAppToForeground: false },
    },
  ]).catch((err) => console.error('[notifications] failed to register alarm category', err));
}

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
  ensureAlarmCategory();
  ensureAndroidChannels().catch((err) => console.error('[notifications] failed to ensure Android channels', err));
}

export type AlarmKind = 'task-alarm' | 'class-alarm';

// The one place the kind->id-field mapping ('task-alarm' carries taskId,
// 'class-alarm' carries classId) is decided — every writer below calls this
// instead of hand-building the shape itself, and handleAlarmResponse's reader
// mirrors these exact two field names.
function buildAlarmData(kind: AlarmKind, id: string | undefined, title: string): Record<string, unknown> {
  return { kind, title, ...(kind === 'task-alarm' ? { taskId: id } : { classId: id }) };
}

// Handles any user interaction with an alarm notification (task or class) —
// covers all three ways one can arrive: tapping the notification body
// (routes into the in-app Alarm screen), tapping its Snooze action, or
// tapping its Dismiss action. Shared by both the live-listener and
// cold-start paths below.
async function handleAlarmResponse(response: Notifications.NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const kind = data?.kind;
  if (kind !== 'task-alarm' && kind !== 'class-alarm') return;

  // Whichever one of the burst the user acted on, the rest have served their
  // purpose — stop the remaining re-fires regardless of which action this was,
  // AND clear any earlier ones that already fired and are still sitting,
  // un-acted-on, in the notification tray (cancelNotifications alone only
  // stops future ones; an already-delivered notification needs its own
  // dismissNotificationAsync call or it lingers indefinitely). Awaited, not
  // fire-and-forget — this runs from a Dismiss action with
  // opensAppToForeground:false, a short-lived background execution context on
  // some platforms that won't wait around for an un-awaited promise.
  const escalationIds = Array.isArray(data?.escalationIds) ? (data!.escalationIds as string[]) : [];
  if (escalationIds.length) {
    await Promise.all([
      cancelNotifications(escalationIds),
      ...escalationIds.map((eid) => Notifications.dismissNotificationAsync(eid).catch(() => {})),
    ]);
  }

  const id = data?.taskId ? String(data.taskId) : data?.classId ? String(data.classId) : undefined;
  const title = String(data?.title ?? (kind === 'task-alarm' ? 'Task' : 'Class'));

  if (response.actionIdentifier === ALARM_DISMISS_ACTION_ID) {
    // Redundant with the loop above whenever this was a burst member (already
    // covered there) — kept as the sole cleanup for a recurring alarm's
    // single, non-burst notification, which carries no escalationIds. Tapping
    // an action doesn't reliably auto-clear the notification on Android the
    // way it does on iOS, so this is still needed explicitly on both.
    Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    return;
  }

  if (response.actionIdentifier === ALARM_SNOOZE_ACTION_ID) {
    try {
      await snoozeAlarm(kind, { id, title }, ALARM_SNOOZE_MINUTES);
      Alert.alert('Snoozed', `We'll remind you again in ${formatMinutes(ALARM_SNOOZE_MINUTES)}.`);
    } catch (err) {
      console.error('[notifications] failed to snooze from notification action', err);
    }
    return;
  }

  // DEFAULT_ACTION_IDENTIFIER — the notification body itself was tapped.
  // replace, not push — if a second alarm's notification is tapped while an
  // earlier one is still on screen (two alarms minutes apart, app stays
  // foregrounded throughout), this swaps to the new one instead of stacking a
  // second Alarm screen on top, where dismissing it would only reveal the
  // first one still ringing underneath instead of returning to the app.
  router.replace({
    pathname: Routes.ALARM_RINGING,
    params: { kind, id: id ?? '', title },
  });
}

// Wires handleAlarmResponse up for both cases expo-notifications
// distinguishes: the app already running/backgrounded (the listener fires
// immediately) and a fully cold start caused by the tap (nothing is
// listening yet, so the response has to be read back once via
// getLastNotificationResponseAsync instead). Call once from app/_layout.tsx's
// startup effect, alongside initNotificationHandler.
export function registerAlarmNotificationRouting(): () => void {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      handleAlarmResponse(response);
      // Consumed — without this, reopening the app later (even from the home
      // screen icon, not the notification) would re-trigger this same route.
      Notifications.clearLastNotificationResponseAsync();
    })
    .catch((err) => console.error('[notifications] failed to read last response', err));

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleAlarmResponse(response);
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
// plus bypassDnd (Android honors this only while the app also holds
// Notification Policy/DND access, granted manually in system settings — this
// channel setting still helps once that's on, and is a harmless no-op
// otherwise, so it's set unconditionally either way).
async function ensureAndroidAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Best-effort cleanup of the pre-v2 channel this replaced — see
  // ANDROID_ALARM_CHANNEL_ID's comment. Throws if it never existed on this
  // device, which is the common case going forward; safe to ignore.
  Notifications.deleteNotificationChannelAsync('planner-alarms').catch(() => {});
  await Notifications.setNotificationChannelAsync(ANDROID_ALARM_CHANNEL_ID, {
    name: 'Alarms',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    // Bundled custom alarm tone, declared in app.json's expo-notifications
    // plugin `sounds` config — referenced here by bare filename.
    sound: 'alarm_buzzer.wav',
  });
}

// Idempotent from Android's side (setNotificationChannelAsync on an
// already-current channel is a cheap no-op) — called unconditionally on every
// app launch (see initNotificationHandler) rather than only from
// requestNotificationPermission's explicit "enable reminders" action. That
// used to be the *only* place these ran, which meant any device that already
// had reminders enabled before a channel config change (like the v2 bump
// above) would never re-create it — Android silently drops a notification
// posted to a channel id it doesn't recognize, so alarms would never appear
// at all for that device until the user happened to toggle Reminders off and
// back on. Channel creation itself needs no notification permission to be
// granted yet, so this is safe to run before that's ever requested.
async function ensureAndroidChannels(): Promise<void> {
  await ensureAndroidChannel();
  await ensureAndroidAlarmChannel();
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannels();
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

// The content fields that make a notification an "alarm" — custom sound,
// iOS Time-Sensitive interruption level, the Dismiss/Snooze action category,
// and Android's non-swipeable flag. Shared by scheduleOccurrence's recurring
// branches and scheduleAlarmBurst below so 'alarm_buzzer.wav' and this exact
// field set only ever need to be maintained in one place.
function alarmContentFields() {
  return {
    sound: 'alarm_buzzer.wav',
    interruptionLevel: 'timeSensitive' as const,
    categoryIdentifier: ALARM_CATEGORY_ID,
    sticky: Platform.OS === 'android',
  };
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
  // notification — set for alarm task/class notifications (kind:
  // 'task-alarm' | 'class-alarm'), routing to the in-app Alarm screen.
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
  // categoryIdentifier (Snooze/Dismiss action buttons) and sticky
  // (non-swipeable, Android-only) apply here too — only the one-off branch
  // below diverges further, into scheduleAlarmBurst's repeat-until-dismissed
  // behavior. channelId above is what actually controls Android's sound/DND
  // behavior, via the channel itself; sound/interruptionLevel here are iOS-only
  // fields, harmless no-ops on Android.
  const alarmContentExtras = spec.isAlarm ? alarmContentFields() : {};

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

    if (spec.isAlarm) {
      return scheduleAlarmBurst(fireAt, spec.title, spec.bodyForMinutes(minutesUntil), spec.data ?? {});
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: spec.title, body: spec.bodyForMinutes(minutesUntil), data: spec.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId },
    });
    return [id];
  } catch (err) {
    console.error('[notifications] failed to schedule', err);
    return [];
  }
}

// Schedules a one-off alarm as a short burst: fireAt itself, plus
// ALARM_ESCALATION_COUNT more re-fires ALARM_ESCALATION_INTERVAL_MINUTES
// apart, all sharing a custom-identifier group so any one of them (via
// handleAlarmResponse above) can cancel the rest the moment the user acts on
// it. Used by scheduleOccurrence's one-off branch above and by snoozeAlarm
// below — both are always one-off, never recurring.
async function scheduleAlarmBurst(
  fireAt: Date,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<string[]> {
  // scheduleOccurrence's one-off branch already checked this before delegating
  // here, but snoozeAlarm calls this directly — re-checking keeps this
  // function safe to call from anywhere, not dependent on its one existing
  // caller's own guard.
  if (!(await hasPermission())) return [];

  const channelId = Platform.OS === 'android' ? ANDROID_ALARM_CHANNEL_ID : undefined;
  const groupBase = `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // iOS enforces a hard, fixed 64-pending-local-notification cap shared across
  // every reminder this app has ever scheduled (lead+exact for every task/
  // class/bill, plus now up to 4 per alarm) — anything scheduled past that
  // ceiling is silently never fired, with no error surfaced anywhere to catch
  // it. If the queue's already close to full, shrink (or drop) the escalation
  // extras rather than risk the burst as a whole silently failing outright:
  // one guaranteed ring beats a fuller burst that might not show up at all.
  // Android has no comparable cap, but the check itself is cheap and harmless
  // there — never platform-gated below.
  let escalationCount = ALARM_ESCALATION_COUNT;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const headroom = 64 - pending.length - 1; // -1 reserves the main alarm itself
    if (headroom < escalationCount) escalationCount = Math.max(0, headroom);
  } catch (err) {
    // Can't introspect the pending count — proceed with the full burst rather
    // than degrade on a guess.
    console.error('[notifications] failed to check pending notification count', err);
  }

  // id and fire offset computed together, index-for-index, in one array — not
  // two separately-built arrays zipped back together by position, which would
  // silently desync if either one were ever filtered/reordered independently.
  const burst = Array.from({ length: escalationCount + 1 }, (_, i) => ({
    id: `${groupBase}-${i}`,
    offsetMinutes: i * ALARM_ESCALATION_INTERVAL_MINUTES, // i=0 is the original fire, at offset 0
  }));
  const ids = burst.map((b) => b.id);

  const scheduled = await Promise.all(
    burst.map(({ id, offsetMinutes }) =>
      Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title,
          body,
          ...alarmContentFields(),
          data: { ...data, escalationIds: ids },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt.getTime() + offsetMinutes * 60_000),
          channelId,
        },
      })
        .then(() => id as string | null)
        .catch((err) => {
          console.error('[notifications] failed to schedule alarm escalation', err);
          return null;
        })
    )
  );
  return scheduled.filter((scheduledId): scheduledId is string => !!scheduledId);
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
    data: isAlarm ? buildAlarmData('task-alarm', task.id, task.title) : undefined,
  });
  const [lead, exact] = await Promise.all([
    scheduleOccurrence(spec(REMINDER_LEAD_MINUTES)),
    scheduleOccurrence(spec(0, task.alarmEnabled)),
  ]);
  return [...lead, ...exact];
}

// Fired from the Alarm screen's "Snooze" button or the notification's own
// Snooze action — a single one-off alarm burst "minutes" from now, for
// either a task or a class. Not persisted onto the entity's notificationIds:
// it's short-lived and self-consuming, not worth a round trip to track for
// cancellation the way the real due/start-time notification is.
export async function snoozeAlarm(
  kind: AlarmKind,
  entity: { id?: string; title: string },
  minutes: number = ALARM_SNOOZE_MINUTES
): Promise<string[]> {
  const fireAt = new Date(Date.now() + minutes * 60_000);
  const isTask = kind === 'task-alarm';
  const ids = await scheduleAlarmBurst(
    fireAt,
    `${isTask ? 'Task' : 'Class'}: ${entity.title}`,
    isTask ? dueBody(0) : startBody(0),
    buildAlarmData(kind, entity.id, entity.title)
  );
  // Not awaited — see persistSnoozeIds' doc comment. The alarm itself is
  // already scheduled regardless of whether this succeeds.
  persistSnoozeIds(kind, entity.id, ids);
  return ids;
}

// Merges a snooze burst's ids into the entity's own notificationIds so
// TasksContext's toggleDone/updateTask/removeTask and useClassActions'
// saveClass/removeClass — which already unconditionally cancel an entity's
// notificationIds on completion, edit, or deletion — pick up the snooze burst
// for free too, instead of it being an untracked, un-cancelable burst that
// could keep ringing after the item's already been dealt with. Best-effort,
// fire-and-forget: a user without connectivity at snooze time just falls back
// to the old untracked behavior, no worse off than before this existed, and
// the alarm itself already fired regardless of whether this succeeds.
async function persistSnoozeIds(kind: AlarmKind, id: string | undefined, newIds: string[]): Promise<void> {
  if (!id || !newIds.length) return;
  try {
    if (kind === 'task-alarm') {
      const tasks = await taskService.list();
      const task = tasks.find((t) => t.id === id);
      if (!task) return; // deleted/not found — nothing to attach to
      await taskService.update(id, { notificationIds: [...(task.notificationIds ?? []), ...newIds] });
    } else {
      const plan = await planService.get<StudentPlan>('student');
      if (!plan?.classes.some((c) => c.id === id)) return;
      const classes = plan.classes.map((c) =>
        c.id === id ? { ...c, notificationIds: [...(c.notificationIds ?? []), ...newIds] } : c
      );
      await planService.save('student', { ...plan, classes });
    }
  } catch (err) {
    console.error('[notifications] failed to persist snoozed alarm ids', err);
  }
}

export async function scheduleClassNotifications(item: {
  // Same reasoning as scheduleTaskNotifications' id — absent only for a
  // brand-new class not yet assigned a real id by the backend.
  id?: string;
  courseName: string;
  startDate: string;
  time: string;
  recurring: boolean;
  freq: RecurFreq;
  dayIdxs: number[];
  alarmEnabled?: boolean;
}): Promise<string[]> {
  // Same rule as tasks: only the exact start-time notification (leadMinutes:
  // 0) ever gets isAlarm — the 15-min lead stays a gentle heads-up either way.
  const spec = (leadMinutes: number, isAlarm?: boolean): OccurrenceSpec => ({
    title: `Class: ${item.courseName}`,
    bodyForMinutes: startBody,
    dateIso: item.startDate,
    time: item.time,
    recurring: item.recurring,
    freq: item.freq,
    dayIdxs: item.dayIdxs,
    leadMinutes,
    isAlarm,
    data: isAlarm ? buildAlarmData('class-alarm', item.id, item.courseName) : undefined,
  });
  const [lead, exact] = await Promise.all([
    scheduleOccurrence(spec(REMINDER_LEAD_MINUTES)),
    scheduleOccurrence(spec(0, item.alarmEnabled)),
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
    if (days <= 0) return `${bill.name} is due today — ${formatCurrency(bill.amount)}`;
    if (days >= 6) return `${bill.name} is due in 1 week — ${formatCurrency(bill.amount)}`;
    return `${bill.name} is due in ${days} day${days === 1 ? '' : 's'} — ${formatCurrency(bill.amount)}`;
  };
  const dueBodyText = () => `${bill.name} is due today — ${formatCurrency(bill.amount)}`;

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
  // In parallel, not one at a time — an alarm's notificationIds can now hold
  // up to ~6 entries (1 lead + up to 5 burst members), and each cancel is an
  // independent native-bridge round trip with nothing to serialize for.
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {
        // Already fired/cancelled — safe to ignore.
      })
    )
  );
}
