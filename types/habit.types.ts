import type { TaskCategoryId } from '@/constants/taskMeta';

export interface Habit {
  id: string;
  name: string;
  category: TaskCategoryId;
  createdAt: string;
  completedDates: string[];
  streak: number;
  week: boolean[];
  doneToday: boolean;
}

export interface NewHabitInput {
  name: string;
  category: TaskCategoryId;
}
