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
  week: boolean[];
  doneToday: boolean;
}

export interface NewHabitInput {
  name: string;
  category: TaskCategoryId;
  freq: HabitFrequency;
}
