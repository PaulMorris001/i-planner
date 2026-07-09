import { Response } from 'express';
import { Task, toPublicTask } from '../models/Task';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

export async function listTasks(req: AuthedRequest, res: Response) {
  const tasks = await Task.find({ firebaseUid: req.userId });
  res.json(tasks.map(toPublicTask));
}

export async function createTask(req: AuthedRequest, res: Response) {
  const { title, category, priority, day, hour, time, dueDate, recurring, notes } = req.body ?? {};

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
    notes: notes ?? '',
  });

  res.status(201).json(toPublicTask(task));
}

export async function updateTask(req: AuthedRequest, res: Response) {
  const task = await findOwnedOrThrow(Task, req.params.id, req.userId!);

  const { title, category, priority, day, hour, time, dueDate, done, recurring, notes } = req.body ?? {};
  if (title !== undefined) task.title = title;
  if (category !== undefined) task.category = category;
  if (priority !== undefined) task.priority = priority;
  if (day !== undefined) task.day = Number(day);
  if (hour !== undefined) task.hour = Number(hour);
  if (time !== undefined) task.time = time;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (done !== undefined) task.done = !!done;
  if (recurring !== undefined) task.recurring = !!recurring;
  if (notes !== undefined) task.notes = notes;

  await task.save();
  res.json(toPublicTask(task));
}

export async function deleteTask(req: AuthedRequest, res: Response) {
  const task = await findOwnedOrThrow(Task, req.params.id, req.userId!);
  await task.deleteOne();
  res.status(204).send();
}
