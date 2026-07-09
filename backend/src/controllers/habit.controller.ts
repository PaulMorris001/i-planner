import { Response } from 'express';
import { Habit, toPublicHabit } from '../models/Habit';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

// Matches the frontend's fixed demo "today" index (Tuesday) — see app/habits.tsx.
const TODAY_IDX = 1;

export async function listHabits(req: AuthedRequest, res: Response) {
  const habits = await Habit.find({ firebaseUid: req.userId });
  res.json(habits.map(toPublicHabit));
}

export async function createHabit(req: AuthedRequest, res: Response) {
  const { name, category } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Name is required.', 'general');
  }
  if (!category) {
    throw new ApiError(400, 'Category is required.', 'general');
  }

  const habit = await Habit.create({
    firebaseUid: req.userId,
    name: name.trim(),
    category,
    streak: 0,
    week: [false, false, false, false, false, false, false],
  });

  res.status(201).json(toPublicHabit(habit));
}

export async function toggleHabitToday(req: AuthedRequest, res: Response) {
  const habit = await findOwnedOrThrow(Habit, req.params.id, req.userId!);
  habit.week[TODAY_IDX] = !habit.week[TODAY_IDX];
  habit.markModified('week');
  await habit.save();
  res.json(toPublicHabit(habit));
}
