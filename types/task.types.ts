import type { TaskCategoryId, TaskPriorityId } from '@/constants/taskMeta';

export interface Task {
  id: string;
  title: string;
  category: TaskCategoryId;
  priority: TaskPriorityId;
  day: number;
  hour: number;
  time: string;
  dueDate: string;
  done: boolean;
  recurring: boolean;
  notes: string;
}

export type NewTaskInput = Omit<Task, 'id' | 'done'>;
