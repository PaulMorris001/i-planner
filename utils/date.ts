// Monday-start weekday index (0=Mon .. 6=Sun), matching the app's day-grid
// convention used across Planner, Habits, and Student Plan classes.
export function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// "Jun 2027"-style formatting for goal target dates.
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
