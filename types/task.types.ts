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
  // Calendar-sync event ids — only ever set when dueDate is non-empty (a task
  // with no fixed date has nothing to sync to a calendar).
  appleEventId?: string;
  googleEventId?: string;
}

export type NewTaskInput = Omit<Task, 'id' | 'done'>;
