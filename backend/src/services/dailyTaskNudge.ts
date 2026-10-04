import { Settings } from '../models/Settings';
import { Task, TaskDocument } from '../models/Task';
import { localDatePart } from './calendarEventTime';
import { sendPushToUser, REMINDERS_CHANNEL_ID } from './pushNotifications';

// The 10 PM "you still have tasks left today" push. Separate from the per-task
// reminders, which are scheduled on the phone: this runs on the server, so it
// reflects what's actually still open at 10 PM even if the app hasn't been
// opened all day.
//
// Every few minutes, for each time zone users are in, check whether it's the
// 10 PM hour there; if so, push to each opted-in user in that zone with open
// tasks for today. Sending anywhere in the 22:00-22:59 window (not just at
// 22:00 exactly) means a deploy or restart around 10 PM doesn't skip a day.

const NUDGE_HOUR = 22;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let running = false;

// "YYYY-MM-DD" and hour (0-23) right now in an IANA time zone, or null if the
// zone name is invalid.
function localNow(timeZone: string): { date: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
  } catch {
    return null;
  }
}

// Monday-start weekday (0=Mon..6=Sun) of a "YYYY-MM-DD" date — the same
// convention as Task.dayIdxs.
function weekdayIdx(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// Whether this task is scheduled for `today` (user-local) and still open.
// Exported for tests.
export function isOpenToday(task: TaskDocument, today: string, timeZone: string): boolean {
  if (!task.dueDate) return false;
  const due = localDatePart(task.dueDate, timeZone);
  if (task.recurring && task.freq && task.dayIdxs?.length) {
    // Recurring: today must be one of its days, on or after it started, and
    // this particular day not already ticked off.
    return due <= today && task.dayIdxs.includes(weekdayIdx(today)) && !(task.completedDates ?? []).includes(today);
  }
  return due === today && !task.done;
}

function quote(title: string): string {
  const t = title.trim();
  return `"${t.length > 28 ? `${t.slice(0, 27)}…` : t}"`;
}

// Exported for tests.
export function nudgeContent(open: Pick<TaskDocument, 'title'>[]) {
  const n = open.length;
  const named = open.slice(0, 2).map((t) => quote(t.title));
  const rest = n - named.length;
  const list = rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(' and ');
  return {
    title: n === 1 ? '1 task left today' : `${n} tasks left today`,
    body: `${list} ${n === 1 ? 'is' : 'are'} still open. Finish up or move ${n === 1 ? 'it' : 'them'} to tomorrow.`,
    route: '/planner',
  };
}

async function nudgeUser(firebaseUid: string, timeZone: string, today: string): Promise<void> {
  // Claim today's slot atomically first, so overlapping checks (or more than
  // one server instance) can never push the same user twice in a day.
  const claimed = await Settings.findOneAndUpdate(
    { firebaseUid, lastTaskNudgeDate: { $ne: today } },
    { $set: { lastTaskNudgeDate: today } }
  );
  if (!claimed) return;

  const tasks = await Task.find({ firebaseUid, dueDate: { $ne: '' } });
  const open = tasks.filter((t) => isOpenToday(t, today, timeZone));
  if (!open.length) return;

  await sendPushToUser(firebaseUid, nudgeContent(open), { kind: 'task-nudge', channelId: REMINDERS_CHANNEL_ID });
}

async function checkAllTimeZones(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Respects the in-app Reminders switch: turning reminders off stops this too.
    const zones = (await Settings.distinct('timeZone', { remindersEnabled: true })) as string[];
    for (const timeZone of zones) {
      const now = timeZone ? localNow(timeZone) : null;
      if (!now || now.hour !== NUDGE_HOUR) continue;
      const users = await Settings.find(
        { timeZone, remindersEnabled: true, lastTaskNudgeDate: { $ne: now.date } },
        'firebaseUid'
      );
      for (const { firebaseUid } of users) {
        await nudgeUser(firebaseUid, timeZone, now.date).catch((err) =>
          console.error('[dailyTaskNudge] failed for user', firebaseUid, err)
        );
      }
    }
  } catch (err) {
    console.error('[dailyTaskNudge] check failed', err);
  } finally {
    running = false;
  }
}

export function startDailyTaskNudges(): void {
  void checkAllTimeZones();
  setInterval(() => void checkAllTimeZones(), CHECK_INTERVAL_MS);
}
