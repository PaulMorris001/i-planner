import type { TaskCategoryId } from '@/constants/taskMeta';

export interface Habit {
  id: string;
  name: string;
  category: TaskCategoryId;
  streak: number;
  week: boolean[];
}

export interface NewHabitInput {
  name: string;
  category: TaskCategoryId;
}
