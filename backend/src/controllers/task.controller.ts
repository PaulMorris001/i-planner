import { Response } from 'express';
import { Task, toPublicTask } from '../models/Task';
import { Settings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { deleteTaskEvent, upsertTaskEvent } from '../services/googleCalendarSync';

async function syncTaskToGoogle(
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

async function unsyncTaskFromGoogle(firebaseUid: string, task: { googleEventId?: string }) {
  if (!task.googleEventId) return;
  const settings = await Settings.findOne({ firebaseUid });
  if (!settings?.googleCalendarConnected) return;
  await deleteTaskEvent(settings, task);
}

export async function listTasks(req: AuthedRequest, res: Response) {
  const tasks = await Task.find({ firebaseUid: req.userId });
  res.json(tasks.map(toPublicTask));
}

export async function createTask(req: AuthedRequest, res: Response) {
  const { title, category, priority, day, hour, time, dueDate, recurring, freq, dayIdxs, notes, appleEventIds } =
    req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (!category || !priority) {
    throw new ApiError(400, 'Category and priority are required.', 'general');
  }

  const task = await Task.create({
    firebaseUid: req.userId,
    title: title.trim(),
    category,
    priority,
    day: Number(day) || 0,
    hour: Number(hour) || 0,
    time: time ?? '',
    dueDate: dueDate ?? '',
    recurring: !!recurring,
    freq: freq ?? undefined,
    dayIdxs: Array.isArray(dayIdxs) ? dayIdxs : undefined,
    notes: notes ?? '',
    // Apple sync runs client-side — the frontend already created the device
    // calendar event(s) before this request and just wants the ids persisted.
    appleEventIds: Array.isArray(appleEventIds) ? appleEventIds : undefined,
  });

  task.googleEventId = await syncTaskToGoogle(req.userId!, task);
  if (task.isModified('googleEventId')) await task.save();

  res.status(201).json(toPublicTask(task));
}

export async function updateTask(req: AuthedRequest, res: Response) {
  const task = await findOwnedOrThrow(Task, req.params.id, req.userId!);

  const {
    title, category, priority, day, hour, time, dueDate, done, recurring, freq, dayIdxs, notes, appleEventIds,
  } = req.body ?? {};
  // Google sync only cares about fields that actually affect the calendar event —
  // a bare { done } toggle or an { appleEventIds } id-persist patch shouldn't touch it.
  const hasContentChange = [title, category, priority, day, hour, time, dueDate, recurring, freq, dayIdxs, notes]
    .some((v) => v !== undefined);

  if (title !== undefined) task.title = title;
  if (category !== undefined) task.category = category;
  if (priority !== undefined) task.priority = priority;
  if (day !== undefined) task.day = Number(day);
  if (hour !== undefined) task.hour = Number(hour);
  if (time !== undefined) task.time = time;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (done !== undefined) task.done = !!done;
  if (recurring !== undefined) task.recurring = !!recurring;
  if (freq !== undefined) task.freq = freq;
  if (dayIdxs !== undefined) task.dayIdxs = Array.isArray(dayIdxs) ? dayIdxs : undefined;
  if (notes !== undefined) task.notes = notes;
  if (appleEventIds !== undefined) task.appleEventIds = Array.isArray(appleEventIds) ? appleEventIds : undefined;

  if (hasContentChange) {
    task.googleEventId = await syncTaskToGoogle(req.userId!, task);
  }

  await task.save();
  res.json(toPublicTask(task));
}

export async function deleteTask(req: AuthedRequest, res: Response) {
  const task = await findOwnedOrThrow(Task, req.params.id, req.userId!);
  await unsyncTaskFromGoogle(req.userId!, task);
  await task.deleteOne();
  res.status(204).send();
}
