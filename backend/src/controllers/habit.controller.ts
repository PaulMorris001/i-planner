import { Response } from 'express';
import { Habit, toPublicHabit, toDateKey, HabitFrequency } from '../models/Habit';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

const VALID_FREQS: HabitFrequency[] = ['daily', 'weekdays', 'weekly', 'monthly'];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The client sends its own local calendar day (utils/date.ts's toDateKey, NOT
// UTC) for every habit request — see toPublicHabit's doc comment for why the
// server's own clock can't stand in for this. Falls back to the server's UTC
// date only if a client somehow omits it (defensive, not the expected path).
function clientTodayKey(value: unknown): string {
  return typeof value === 'string' && DATE_KEY_RE.test(value) ? value : toDateKey(new Date());
}

export async function listHabits(req: AuthedRequest, res: Response) {
  const todayKey = clientTodayKey(req.query.localDate);
  const habits = await Habit.find({ firebaseUid: req.userId });
  res.json(habits.map((habit) => toPublicHabit(habit, todayKey)));
}

export async function createHabit(req: AuthedRequest, res: Response) {
  const { name, category, freq, localDate } = req.body ?? {};

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
    freq: VALID_FREQS.includes(freq) ? freq : 'daily',
    completedDates: [],
  });

  res.status(201).json(toPublicHabit(habit, clientTodayKey(localDate)));
}

export async function updateHabit(req: AuthedRequest, res: Response) {
  const habit = await findOwnedOrThrow(Habit, req.params.id, req.userId!);

  const { name, category, freq, localDate } = req.body ?? {};
  if (name !== undefined) habit.name = name;
  if (category !== undefined) habit.category = category;
  if (freq !== undefined && VALID_FREQS.includes(freq)) habit.freq = freq;

  await habit.save();
  res.json(toPublicHabit(habit, clientTodayKey(localDate)));
}

export async function deleteHabit(req: AuthedRequest, res: Response) {
  const habit = await findOwnedOrThrow(Habit, req.params.id, req.userId!);
  await habit.deleteOne();
  res.status(204).send();
}

export async function toggleHabitToday(req: AuthedRequest, res: Response) {
  const existing = await findOwnedOrThrow(Habit, req.params.id, req.userId!);
  const todayKey = clientTodayKey(req.body?.localDate);

  // Atomic $pull/$addToSet avoids a read-modify-write race from near-simultaneous
  // toggles; $pull also self-heals any duplicates already present.
  const pulled = await Habit.findOneAndUpdate(
    { _id: existing._id, completedDates: todayKey },
    { $pull: { completedDates: todayKey } },
    { new: true }
  );

  const habit =
    pulled ??
    (await Habit.findOneAndUpdate(
      { _id: existing._id },
      { $addToSet: { completedDates: todayKey } },
      { new: true }
    ));

  res.json(toPublicHabit(habit!, todayKey));
}
