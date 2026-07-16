import type { TaskCategoryId, TaskPriorityId } from '@/constants/taskMeta';

export type TaskFrequency = 'weekly' | 'weekdays' | 'daily';

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
  // Only meaningful when recurring is true. freq mirrors ClassItem's frequency
  // options (minus 'monthly', which doesn't fit a day-of-week grid); dayIdxs is
  // the Monday-start weekday indices (0=Mon..6=Sun) this task recurs on, derived
  // from dueDate the same way ClassItem's dayIdxs is derived from startDate.
  freq?: TaskFrequency;
  dayIdxs?: number[];
  notes: string;
  // Calendar-sync event ids — only ever set when dueDate is non-empty (a task
  // with no fixed date has nothing to sync to a calendar). appleEventIds is an
  // array for the same reason as ClassItem.appleEventIds: a recurring weekly/
  // weekdays task gets one Apple event per dayIdxs occurrence.
  appleEventIds?: string[];
  googleEventId?: string;
}

export type NewTaskInput = Omit<Task, 'id' | 'done'>;
