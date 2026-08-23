import type { TaskCategoryId, TaskPriorityId } from '@/constants/taskMeta';

export type TaskFrequency = 'weekly' | 'weekdays' | 'daily';

export interface Task {
  id: string;
  title: string;
  category: TaskCategoryId;
  priority: TaskPriorityId;
  // Planner grid position (Monday-start weekday index, and hour 0-23 with 23
  // meaning "no specific time") — independent of dueDate/time below, which are
  // the task's actual due date/time. day/hour place the task in Planner's
  // day/week grid; dueDate/time are what's shown as the due date and used for
  // calendar sync and reminders.
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
  // Local "YYYY-MM-DD" dates this task was marked done on — only meaningful
  // when recurring is true (see utils/date.ts's isTaskDoneOnDate). A one-time
  // task uses `done` instead.
  completedDates?: string[];
  notes: string;
  // Calendar-sync event ids — only ever set when dueDate is non-empty (a task
  // with no fixed date has nothing to sync to a calendar). appleEventIds is an
  // array for the same reason as ClassItem.appleEventIds: a recurring weekly/
  // weekdays task gets one Apple event per dayIdxs occurrence.
  appleEventIds?: string[];
  googleEventId?: string;
  // Locally-scheduled expo-notifications reminder ids — one per weekday
  // occurrence for a 'weekdays' task, same reasoning as appleEventIds.
  notificationIds?: string[];
  // Set once, at creation, when this task was created by converting an
  // imported calendar event (see NewTaskModalContext's TaskDraft) — its
  // appleEventIds/googleEventId point at a real pre-existing calendar event
  // the app doesn't own. When true, TasksContext must never delete/recreate
  // that event on edit or delete — only the app's own copy of the task
  // details changes, the user's actual calendar entry is left alone.
  calendarLinkExternal?: boolean;
}

export type NewTaskInput = Omit<Task, 'id' | 'done'>;
