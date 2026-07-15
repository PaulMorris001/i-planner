import { Response } from 'express';
import { Goal, toPublicGoal } from '../models/Goal';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { generateGoalMilestones } from '../services/goalMilestones';

interface MilestoneDoc {
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

  const milestoneDocs: MilestoneDoc[] = Array.isArray(milestones)
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
    milestones: milestoneDocs,
    // Freshly created milestones are always undone, so pct is always 0 here
    // regardless of count — pctFromMilestones is still used for consistency with
    // updateGoal, where it does the real work.
    pct: pctFromMilestones(milestoneDocs),
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
  if (Array.isArray(milestones)) {
    // Preserve _id for milestones the client references by id (existing ones being
    // toggled/edited) — rebuilding every subdocument from scratch on every save
    // reassigns fresh ids app-wide, which churns React's list keys on the client for
    // every milestone, not just the one that changed.
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
