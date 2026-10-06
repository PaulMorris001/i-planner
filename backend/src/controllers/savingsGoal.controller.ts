import { Response } from 'express';
import { SavingsGoal, toPublicSavingsGoal } from '../models/SavingsGoal';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { awardPointsSafely, isOldEnoughForPoints, utcDateKey } from '../services/points';
import { POINTS } from '../constants/points';

export async function listSavingsGoals(req: AuthedRequest, res: Response) {
  const goals = await SavingsGoal.find({ firebaseUid: req.userId }).sort({ targetDate: 1 });
  res.json(goals.map(toPublicSavingsGoal));
}

export async function createSavingsGoal(req: AuthedRequest, res: Response) {
  const { name, targetAmount, savedAmount, targetDate } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Goal name is required.', 'general');
  }
  if (typeof targetAmount !== 'number' || !(targetAmount > 0)) {
    throw new ApiError(400, 'Target amount must be greater than 0.', 'general');
  }
  if (savedAmount !== undefined && (typeof savedAmount !== 'number' || savedAmount < 0)) {
    throw new ApiError(400, 'Saved amount must be 0 or more.', 'general');
  }
  if (!targetDate || typeof targetDate !== 'string') {
    throw new ApiError(400, 'Target date is required.', 'general');
  }

  const goal = await SavingsGoal.create({
    firebaseUid: req.userId,
    name: name.trim(),
    targetAmount,
    savedAmount: typeof savedAmount === 'number' ? savedAmount : 0,
    targetDate,
  });

  res.status(201).json(toPublicSavingsGoal(goal));
}

export async function updateSavingsGoal(req: AuthedRequest, res: Response) {
  const goal = await findOwnedOrThrow(SavingsGoal, req.params.id, req.userId!);

  const { name, targetAmount, savedAmount, targetDate } = req.body ?? {};
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Goal name is required.', 'general');
    }
    goal.name = name.trim();
  }
  if (targetAmount !== undefined) {
    if (typeof targetAmount !== 'number' || !(targetAmount > 0)) {
      throw new ApiError(400, 'Target amount must be greater than 0.', 'general');
    }
    goal.targetAmount = targetAmount;
  }
  const savedBefore = goal.savedAmount;
  const targetBefore = goal.targetAmount;
  if (savedAmount !== undefined) {
    if (typeof savedAmount !== 'number' || savedAmount < 0) {
      throw new ApiError(400, 'Saved amount must be 0 or more.', 'general');
    }
    goal.savedAmount = savedAmount;
  }
  if (targetDate !== undefined) {
    if (!targetDate || typeof targetDate !== 'string') {
      throw new ApiError(400, 'Target date is required.', 'general');
    }
    goal.targetDate = targetDate;
  }

  await goal.save();

  // Points: a little for every update that adds money (once per goal per day, so
  // adding in many small bits earns once), and a bigger bonus once, when the goal
  // reaches its target. Both need the goal to have existed for a few minutes.
  if (isOldEnoughForPoints(goal)) {
    if (goal.savedAmount > savedBefore) {
      await awardPointsSafely(req.userId!, `savings:${goal.id}:${utcDateKey()}`, 'savings', POINTS.savingsUpdate);
    }
    const wasComplete = savedBefore >= targetBefore;
    if (goal.savedAmount >= goal.targetAmount && !wasComplete) {
      await awardPointsSafely(req.userId!, `savings-done:${goal.id}`, 'savings', POINTS.savingsDone);
    }
  }

  res.json(toPublicSavingsGoal(goal));
}

export async function deleteSavingsGoal(req: AuthedRequest, res: Response) {
  const goal = await findOwnedOrThrow(SavingsGoal, req.params.id, req.userId!);
  await goal.deleteOne();
  res.status(204).send();
}
