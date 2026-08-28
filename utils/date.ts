import type { Task } from '@/types/task.types';
import type { ClassItem } from '@/types/plan.types';
import { parseTimeToMinutes } from '@/utils/time';

// Monday-start day names, matching weekdayIndexMonday's index convention (0=Mon..6=Sun).
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Monday-start weekday index (0=Mon .. 6=Sun), matching the app's day-grid
// convention used across Planner, Habits, and Student Plan classes.
export function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// "Jun 2027"-style formatting for goal target dates.
export function formatMonthYear(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// "Jun 12"-style short date for a due/created/exam date label.
export function formatShortDate(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "Mon · Wed · Fri" recurrence summary. Defaults to ' · '; planner.tsx
// passes '/' for its tighter layout.
export function formatClassDays(item: ClassItem, separator = ' · '): string {
  if (!item.recurring) return 'One time';
  if (item.freq === 'monthly') return 'Monthly';
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join(separator);
}

// "12 Jun 2027"-style label for a date-picker button. Distinct from formatShortDate
// above — different locale/fields, and takes a Date rather than an ISO string.
export function formatDatePickerLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "9:30 AM"-style label for a time-picker button's display value.
export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Inverse of formatTimeLabel/parseTimeToMinutes — turns a stored "9:30 AM" string
// back into a Date (today's date, that time-of-day) for handing to a <DateTimePicker>.
export function parseTimeToDate(time: string): Date {
  const minutes = parseTimeToMinutes(time);
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

// Which weekdays a recurring item occurs on, Monday-start. Only covers the 3
// frequencies that map to a weekly day-grid; a class's 'monthly' option has no
// grid slot and is handled by its caller instead.
export function dayIdxsForFrequency(freq: 'weekly' | 'weekdays' | 'daily', referenceWeekday: number): number[] {
  if (freq === 'weekly') return [referenceWeekday];
  if (freq === 'weekdays') return [0, 1, 2, 3, 4];
  return [0, 1, 2, 3, 4, 5, 6];
}

// True when a task should appear in dayIdx's Planner column — either it's the
// task's own due-date weekday, or (for a recurring weekly/weekdays/daily task)
// dayIdx is one of its recurrence days. dayIdxs always includes the original due
// date's weekday, so checking it alone covers both cases once it's present.
export function taskOccursOnDay(task: Task, dayIdx: number): boolean {
  if (task.recurring && task.freq && task.dayIdxs?.length) {
    return task.dayIdxs.includes(dayIdx);
  }
  return task.day === dayIdx;
}

export function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Local (not UTC) "YYYY-MM-DD" — matches weekdayIndexMonday/localMidnight's
// local-time convention, so a date near midnight keys to the calendar day the
// user actually sees rather than shifting under UTC.
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Whether `task` is done for the occurrence on `date`. A one-time task has a
// single completion state (`done`); a recurring task is one Task document
// shared across every weekday it occurs on, so its completion has to be
// tracked per calendar date (`completedDates`) instead — otherwise
// completing today's occurrence would show every other occurrence as done.
export function isTaskDoneOnDate(task: Task, date: Date): boolean {
  if (!task.recurring) return task.done;
  return (task.completedDates ?? []).includes(toDateKey(date));
}

// dueDate/startDate/targetDate carry two different shapes depending on how they
// were created, and both need handling:
//  - Plain "YYYY-MM-DD" with no time-of-day (AI/syllabus-created tasks, some
//    onboarding items) — `new Date(iso)` parses that as UTC midnight, landing on
//    the *previous* local day for anyone west of UTC. Reading the Y/M/D digits
//    directly avoids that UTC round-trip.
//  - A full timestamp (has a "T", from a date picker's `Date.toISOString()`) already
//    encodes a real instant, so standard `new Date(iso)` parsing is correct;
//    re-deriving from the leading digits would be wrong since those are the
//    instant's *UTC* day, which can differ from its local day.
// Prefer this over `new Date(iso)` for any same-day comparison (localMidnight,
// isSameLocalDay, weekday extraction, etc.).
export function parseISODateLocal(iso: string): Date {
  if (iso.includes('T')) return new Date(iso);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// True when dateIso's calendar day (local time) is today or later. Deliberately
// ignores whatever time-of-day is embedded in the ISO string — that varies by
// creation path (AI/syllabus tasks pin UTC midnight; manual ones carry whatever
// the date picker held) and isn't meaningful on its own, so comparing full instants
// against Date.now() could wrongly drop something due later today. A task's real
// time-of-day, when it has one, lives in its separate `hour`/`time` fields.
export function isDueTodayOrLater(dateIso: string): boolean {
  const date = parseISODateLocal(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  return localMidnight(date) >= localMidnight(new Date());
}

// The next upcoming date a recurring task occurs on (today included, if not
// already done today) — a recurring task's stored `dueDate` is fixed at whatever
// date it was first set to and never advances, so it's wrong to use directly for
// "when is this next due" (see StudentPathView.tsx's "Up next" card). Returns
// null for a non-recurring task or one with no recurrence days.
export function nextTaskOccurrence(task: Task): Date | null {
  if (!task.recurring || !task.dayIdxs?.length) return null;
  const today = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (!task.dayIdxs.includes(weekdayIndexMonday(candidate))) continue;
    if (offset === 0 && isTaskDoneOnDate(task, candidate)) continue;
    return candidate;
  }
  return null;
}

// Current task-completion streak: counts consecutive "active" days (a calendar day
// with at least one task due, by dueDate, not recurring occurrences) working
// backward from today, where at least one due task was completed. A day with no
// due tasks is skipped — it neither extends nor breaks the streak. Today never
// breaks the streak while still in progress; it only adds once something on it
// is actually completed.
export function computeTaskStreak(tasks: Task[]): number {
  const completedByDay = new Map<number, boolean>();

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const due = parseISODateLocal(task.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const dayMs = localMidnight(due);
    completedByDay.set(dayMs, (completedByDay.get(dayMs) ?? false) || isTaskDoneOnDate(task, due));
  }

  const todayMs = localMidnight(new Date());
  const activeDays = [...completedByDay.keys()]
    .filter((dayMs) => dayMs <= todayMs)
    .sort((a, b) => b - a);

  let streak = 0;
  for (const dayMs of activeDays) {
    const completed = completedByDay.get(dayMs)!;
    if (dayMs === todayMs) {
      if (completed) streak += 1;
      continue;
    }
    if (completed) streak += 1;
    else break;
  }
  return streak;
}
