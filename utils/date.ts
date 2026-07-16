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
