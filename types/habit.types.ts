import type { TaskCategoryId } from '@/constants/taskMeta';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Habit {
  id: string;
  name: string;
  category: TaskCategoryId;
  freq: HabitFrequency;
  createdAt: string;
  completedDates: string[];
  streak: number;
  // This week's completion grid, Monday-start (index 0=Mon..6=Sun) — same
  // weekday convention as ClassItem/Task's dayIdxs.
  week: boolean[];
  doneToday: boolean;
}

export interface NewHabitInput {
  name: string;
  category: TaskCategoryId;
  freq: HabitFrequency;
}
