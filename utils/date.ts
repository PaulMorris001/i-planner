import type { Task } from '@/types/task.types';

// Monday-start weekday index (0=Mon .. 6=Sun), matching the app's day-grid
// convention used across Planner, Habits, and Student Plan classes.
export function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// "Jun 2027"-style formatting for goal target dates.
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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
    const due = new Date(task.dueDate);
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
