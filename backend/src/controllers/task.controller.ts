import { Response } from 'express';
import { Task, toPublicTask } from '../models/Task';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { createTaskDoc, syncTaskToGoogle, unsyncTaskFromGoogle } from '../services/taskCreation';

export async function listTasks(req: AuthedRequest, res: Response) {
  const tasks = await Task.find({ firebaseUid: req.userId });
  res.json(tasks.map(toPublicTask));
}

export async function createTask(req: AuthedRequest, res: Response) {
  const {
    title, category, priority, day, hour, time, dueDate, recurring, freq, dayIdxs, notes, appleEventIds, notificationIds,
  } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (!category || !priority) {
    throw new ApiError(400, 'Category and priority are required.', 'general');
  }

  const task = await createTaskDoc(req.userId!, {
    title,
    category,
    priority,
    day,
    hour,
    time,
    dueDate,
    recurring,
    freq: freq ?? undefined,
    dayIdxs: Array.isArray(dayIdxs) ? dayIdxs : undefined,
    notes,
    // Apple sync and local notification scheduling both run client-side — the
    // frontend already created the device calendar event(s)/reminder(s) before
    // this request and just wants the ids persisted.
    appleEventIds: Array.isArray(appleEventIds) ? appleEventIds : undefined,
    notificationIds: Array.isArray(notificationIds) ? notificationIds : undefined,
  });

  res.status(201).json(toPublicTask(task));
}

export async function updateTask(req: AuthedRequest, res: Response) {
  const task = await findOwnedOrThrow(Task, req.params.id, req.userId!);

  const {
    title, category, priority, day, hour, time, dueDate, done, recurring, freq, dayIdxs, notes, appleEventIds,
    notificationIds,
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
  if (notificationIds !== undefined) task.notificationIds = Array.isArray(notificationIds) ? notificationIds : undefined;

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
