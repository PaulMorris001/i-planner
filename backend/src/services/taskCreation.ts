import { Task, TaskDocument } from '../models/Task';
import { syncTaskToCalendars } from './calendarSync';

// Shared by task.controller.ts's REST endpoint and coachTools.ts's create_task
// tool — one place for day/hour defaults and cloud calendar sync.

export interface CreateTaskInput {
  title: string;
  category: string;
  priority: string;
  day?: number;
  hour?: number;
  time?: string;
  dueDate?: string;
  recurring?: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  notes?: string;
  appleEventIds?: string[];
  notificationIds?: string[];
  // Set when this task is being created from an already-existing calendar
  // event (see calendarImport's "convert to task" flow) — the task should
  // point at that event, not get a brand new one created for it.
  googleEventId?: string;
  // Same "converted from an existing event" idea as googleEventId, but for Outlook.
  outlookEventId?: string;
  calendarLinkExternal?: boolean;
  alarmEnabled?: boolean;
}

export async function createTaskDoc(firebaseUid: string, input: CreateTaskInput): Promise<TaskDocument> {
  const task = await Task.create({
    firebaseUid,
    title: input.title.trim(),
    category: input.category,
    priority: input.priority,
    day: Number(input.day) || 0,
    hour: Number(input.hour) || 0,
    time: input.time ?? '',
    dueDate: input.dueDate ?? '',
    recurring: !!input.recurring,
    freq: input.freq,
    dayIdxs: input.dayIdxs,
    notes: input.notes ?? '',
    appleEventIds: input.appleEventIds,
    notificationIds: input.notificationIds,
    googleEventId: input.googleEventId,
    outlookEventId: input.outlookEventId,
    calendarLinkExternal: input.calendarLinkExternal,
    alarmEnabled: !!input.alarmEnabled,
  });

  // Skips tasks converted from an imported calendar event (calendarLinkExternal)
  // — they already point at a real event, and syncing would duplicate it.
  await syncTaskToCalendars(firebaseUid, task);
  if (task.isModified('googleEventId') || task.isModified('outlookEventId')) await task.save();

  return task;
}
