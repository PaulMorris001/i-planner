import { Task, TaskDocument } from '../models/Task';
import { Settings } from '../models/Settings';
import { deleteTaskEvent, upsertTaskEvent } from './googleCalendarSync';

// Shared by task.controller.ts's REST endpoint and coachTools.ts's create_task
// tool — one place for day/hour defaults and Google Calendar sync.

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
  calendarLinkExternal?: boolean;
}

export async function syncTaskToGoogle(
  firebaseUid: string,
  task: {
    title: string;
    dueDate: string;
    time?: string;
    notes?: string;
    recurring: boolean;
    freq?: 'weekly' | 'weekdays' | 'daily';
    dayIdxs?: number[];
    googleEventId?: string;
  }
) {
  const settings = await Settings.findOne({ firebaseUid });
  if (!settings?.googleCalendarConnected) return undefined;
  // An edit that clears dueDate leaves nothing to sync — delete any existing
  // event instead of leaving it orphaned on the calendar.
  if (!task.dueDate) {
    if (task.googleEventId) await deleteTaskEvent(settings, task);
    return undefined;
  }
  return upsertTaskEvent(settings, task);
}

export async function unsyncTaskFromGoogle(firebaseUid: string, task: { googleEventId?: string }) {
  if (!task.googleEventId) return;
  const settings = await Settings.findOne({ firebaseUid });
  if (!settings?.googleCalendarConnected) return;
  await deleteTaskEvent(settings, task);
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
    calendarLinkExternal: input.calendarLinkExternal,
  });

  // Already pointing at an existing event (converted from an imported
  // calendar event) — syncing now would create a second, duplicate event.
  if (!input.googleEventId) {
    task.googleEventId = await syncTaskToGoogle(firebaseUid, task);
    if (task.isModified('googleEventId')) await task.save();
  }

  return task;
}
