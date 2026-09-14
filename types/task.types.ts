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
  freq?: TaskFrequency;
  dayIdxs?: number[];
  completedDates?: string[];
  notes: string;
  appleEventIds?: string[];
  googleEventId?: string;
  outlookEventId?: string;
  notificationIds?: string[];
  calendarLinkExternal?: boolean;
  alarmEnabled?: boolean;
}

export type NewTaskInput = Omit<Task, 'id' | 'done'>;
