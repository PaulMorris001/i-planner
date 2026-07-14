import { Response } from 'express';
import { Habit, toPublicHabit, toDateKey, HabitFrequency } from '../models/Habit';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

const VALID_FREQS: HabitFrequency[] = ['daily', 'weekdays', 'weekly', 'monthly'];

export async function listHabits(req: AuthedRequest, res: Response) {
  const habits = await Habit.find({ firebaseUid: req.userId });
  res.json(habits.map(toPublicHabit));
}

export async function createHabit(req: AuthedRequest, res: Response) {
  const { name, category, freq } = req.body ?? {};

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

  res.status(201).json(toPublicHabit(habit));
}

export async function updateHabit(req: AuthedRequest, res: Response) {
  const habit = await findOwnedOrThrow(Habit, req.params.id, req.userId!);

  const { name, category, freq } = req.body ?? {};
  if (name !== undefined) habit.name = name;
  if (category !== undefined) habit.category = category;
  if (freq !== undefined && VALID_FREQS.includes(freq)) habit.freq = freq;

  await habit.save();
  res.json(toPublicHabit(habit));
}

export async function deleteHabit(req: AuthedRequest, res: Response) {
  const habit = await findOwnedOrThrow(Habit, req.params.id, req.userId!);
  await habit.deleteOne();
  res.status(204).send();
}

export async function toggleHabitToday(req: AuthedRequest, res: Response) {
  // Validates id format + ownership (404s cleanly on either), same as every
  // other owned-doc lookup.
  const existing = await findOwnedOrThrow(Habit, req.params.id, req.userId!);
  const todayKey = toDateKey(new Date());

  // Read-modify-write on the JS side (find, mutate the array, save) let two
  // near-simultaneous toggle requests both read "not present" and both push,
  // producing duplicate entries — atomic $pull/$addToSet avoids that race and
  // $pull also self-heals any duplicates already present from before this fix.
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

  res.json(toPublicHabit(habit!));
}
