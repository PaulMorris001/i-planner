import type { Task } from '@/types/task.types';

// Monday-start weekday index (0=Mon .. 6=Sun), matching the app's day-grid
// convention used across Planner, Habits, and Student Plan classes.
export function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// "Jun 2027"-style formatting for goal target dates.
export function formatMonthYear(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

// dueDate/startDate/targetDate carry two genuinely different shapes depending
// on how they were created, and this has to handle both correctly:
//  - Plain "YYYY-MM-DD" with no time-of-day (AI/syllabus-created tasks, some
//    onboarding items) — `new Date(iso)` parses that as UTC midnight, which
//    lands on the *previous* local calendar day for anyone west of UTC (e.g.
//    US timezones). Reading the Y/M/D digits directly and building a local
//    date from them avoids that UTC round-trip.
//  - A full timestamp (has a "T", from a date picker's `Date.toISOString()`)
//    — this already encodes a real instant, so standard `new Date(iso)`
//    parsing is correct here; re-deriving from the string's leading digits
//    would actually be wrong, since those digits are the instant's *UTC* day,
//    which can differ from its local day (e.g. a late-evening pick rolls
//    into the next UTC day).
// Prefer this over `new Date(iso)` whenever the result feeds into a same-day
// comparison (localMidnight, isSameLocalDay, weekday extraction, etc.).
export function parseISODateLocal(iso: string): Date {
  if (iso.includes('T')) return new Date(iso);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// True when dateIso's calendar day (local time) is today or later. Deliberately
// ignores whatever time-of-day is embedded in the ISO string itself — that
// varies by creation path (e.g. AI/syllabus-created tasks are pinned to UTC
// midnight, manually-created ones carry whatever time the date picker's Date
// object happened to hold) and isn't meaningful on its own, so comparing full
// instants against Date.now() can wrongly drop something due later today. A
// task's real time-of-day, when it has one, lives in its separate `hour`/`time`
// fields instead.
export function isDueTodayOrLater(dateIso: string): boolean {
  const date = parseISODateLocal(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  return localMidnight(date) >= localMidnight(new Date());
}

// Current task-completion streak: counts consecutive "active" days (any
// calendar day with at least one task due — by its actual dueDate, not
// recurring occurrences) working backward from today, where at least one due
// task on that day was completed. A day with no due tasks is skipped entirely —
// it neither extends nor breaks the streak, it just doesn't count. Today never
// breaks the streak while still in progress (you can't fail a day that isn't
// over yet); it only adds to the streak once something on it is actually
// completed.
export function computeTaskStreak(tasks: Task[]): number {
  const completedByDay = new Map<number, boolean>();

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const due = parseISODateLocal(task.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const dayMs = localMidnight(due);
    completedByDay.set(dayMs, (completedByDay.get(dayMs) ?? false) || task.done);
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
