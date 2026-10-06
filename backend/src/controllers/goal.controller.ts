import { Response } from 'express';
import { Goal, toPublicGoal } from '../models/Goal';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { awardPointsSafely, isOldEnoughForPoints } from '../services/points';
import { POINTS } from '../constants/points';
import { generateGoalMilestones } from '../services/goalMilestones';

interface NewMilestoneInput {
  title: string;
  done: boolean;
  dueLabel: string;
}

function pctFromMilestones(milestones: { done: boolean }[]): number {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

export async function listGoals(req: AuthedRequest, res: Response) {
  const goals = await Goal.find({ firebaseUid: req.userId });
  res.json(goals.map(toPublicGoal));
}

export async function createGoal(req: AuthedRequest, res: Response) {
  const { type, tag, title, color, milestones, targetRole, targetIndustry, targetDate } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (!type || !tag || !color) {
    throw new ApiError(400, 'Type, tag and color are required.', 'general');
  }

  const milestoneInputs: NewMilestoneInput[] = Array.isArray(milestones)
    ? milestones
        .filter((m): m is { title: string; dueLabel?: string } => !!m?.title)
        .map((m) => ({ title: m.title, done: false, dueLabel: m.dueLabel ?? '' }))
    : [];

  const goal = await Goal.create({
    firebaseUid: req.userId,
    type,
    tag,
    title: title.trim(),
    color,
    milestones: milestoneInputs,
    pct: pctFromMilestones(milestoneInputs), // always 0 here, but kept for consistency with updateGoal
    targetRole,
    targetIndustry,
    targetDate,
  });

  res.status(201).json(toPublicGoal(goal));
}

export async function updateGoal(req: AuthedRequest, res: Response) {
  const goal = await findOwnedOrThrow(Goal, req.params.id, req.userId!);

  const { title, tag, color, type, milestones, targetRole, targetIndustry, targetDate } = req.body ?? {};
  if (title !== undefined) goal.title = title;
  if (tag !== undefined) goal.tag = tag;
  if (color !== undefined) goal.color = color;
  if (type !== undefined) goal.type = type;
  if (targetRole !== undefined) goal.targetRole = targetRole;
  if (targetIndustry !== undefined) goal.targetIndustry = targetIndustry;
  if (targetDate !== undefined) goal.targetDate = targetDate;
  const idsBefore = new Set(goal.milestones.map((m) => String(m._id)));
  const doneBefore = new Set(goal.milestones.filter((m) => m.done).map((m) => String(m._id)));
  if (Array.isArray(milestones)) {
    // Preserve _id for referenced milestones so React list keys don't churn client-side.
    const incoming = milestones.filter(
      (m): m is { id?: string; title: string; done?: boolean; dueLabel?: string } => !!m?.title
    );
    const nextMilestones = incoming.map((m) => {
      const existing = m.id ? goal.milestones.id(m.id) : null;
      return {
        ...(existing ? { _id: existing._id } : {}),
        title: m.title,
        done: !!m.done,
        dueLabel: m.dueLabel ?? '',
      };
    });
    goal.milestones.splice(0, goal.milestones.length, ...nextMilestones);
    goal.pct = pctFromMilestones(goal.milestones);
  }

  await goal.save();

  // Points: once per milestone and once when a whole goal is finished, however many
  // times they are ticked and unticked. Only a milestone that existed before this
  // request and was just ticked pays; the goal bonus also needs one of those, so
  // deleting the unfinished milestones can't "complete" a goal.
  if (isOldEnoughForPoints(goal)) {
    const justTicked = goal.milestones.filter((m) => m.done && idsBefore.has(String(m._id)) && !doneBefore.has(String(m._id)));
    for (const m of justTicked) {
      await awardPointsSafely(req.userId!, `milestone:${goal.id}:${m._id}`, 'milestone', POINTS.milestone);
    }
    if (justTicked.length > 0 && goal.milestones.every((m) => m.done)) {
      await awardPointsSafely(req.userId!, `goal-done:${goal.id}`, 'goal', POINTS.goalDone);
    }
  }

  res.json(toPublicGoal(goal));
}

export async function deleteGoal(req: AuthedRequest, res: Response) {
  const goal = await findOwnedOrThrow(Goal, req.params.id, req.userId!);
  await goal.deleteOne();
  res.status(204).send();
}

export async function generateMilestones(req: AuthedRequest, res: Response) {
  const { title, type } = req.body ?? {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (!type || typeof type !== 'string') {
    throw new ApiError(400, 'Type is required.', 'general');
  }

  const suggestions = await generateGoalMilestones({ title: title.trim(), type });
  res.json({ milestones: suggestions });
}
