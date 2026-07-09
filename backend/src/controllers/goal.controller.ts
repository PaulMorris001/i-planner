import { Response } from 'express';
import { Goal, toPublicGoal } from '../models/Goal';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

export async function listGoals(req: AuthedRequest, res: Response) {
  const goals = await Goal.find({ firebaseUid: req.userId });
  res.json(goals.map(toPublicGoal));
}

export async function createGoal(req: AuthedRequest, res: Response) {
  const { type, tag, title, color } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (!type || !tag || !color) {
    throw new ApiError(400, 'Type, tag and color are required.', 'general');
  }

  const goal = await Goal.create({
    firebaseUid: req.userId,
    type,
    tag,
    title: title.trim(),
    color,
    pct: 0,
  });

  res.status(201).json(toPublicGoal(goal));
}

export async function updateGoal(req: AuthedRequest, res: Response) {
  const goal = await findOwnedOrThrow(Goal, req.params.id, req.userId!);

  const { title, pct, tag, color } = req.body ?? {};
  if (title !== undefined) goal.title = title;
  if (pct !== undefined) goal.pct = Number(pct);
  if (tag !== undefined) goal.tag = tag;
  if (color !== undefined) goal.color = color;

  await goal.save();
  res.json(toPublicGoal(goal));
}
