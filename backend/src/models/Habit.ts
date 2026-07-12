import { Schema, model, Document } from 'mongoose';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface HabitDocument extends Document {
  firebaseUid: string;
  name: string;
  category: string;
  freq: HabitFrequency;
  completedDates: string[];
  createdAt: Date;
}

const habitSchema = new Schema<HabitDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Free-form string, canonical list lives in the frontend's constants/taskMeta.ts.
    category: { type: String, required: true },
    freq: { type: String, enum: ['daily', 'weekdays', 'weekly', 'monthly'], default: 'daily' },
    // Calendar days ('YYYY-MM-DD', UTC) the habit was marked done. Streak and
    // the week grid are derived from this plus createdAt rather than stored,
    // so ticking always starts on the day the habit was actually created.
    completedDates: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayOfCurrentWeek(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function isWeekendUTC(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function mondayOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Consecutive completed days counting back from today, stopping at the first
// gap or the habit's creation day. For 'weekdays' habits, weekends are
// skipped entirely — they neither require completion nor break the streak.
// Today itself isn't required to be done yet (grace day) so the streak
// doesn't zero out the instant a new day starts.
function computeDailyStreak(completedDates: string[], createdAt: Date, freq: HabitFrequency): number {
  const completed = new Set(completedDates);
  const createdKey = toDateKey(createdAt);
  const cursor = new Date();

  const skipWeekend = () => {
    while (freq === 'weekdays' && isWeekendUTC(cursor)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  };

  skipWeekend();
  if (!completed.has(toDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    skipWeekend();
  }

  let streak = 0;
  while (toDateKey(cursor) >= createdKey) {
    if (freq === 'weekdays' && isWeekendUTC(cursor)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }
    if (!completed.has(toDateKey(cursor))) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Consecutive periods (weeks or months) with at least one completion,
// counting back from the current period. The current period doesn't need a
// completion yet (grace period), matching the daily grace-day behavior.
function computePeriodStreak(completedDates: string[], createdAt: Date, unit: 'week' | 'month'): number {
  const keyOf = (d: Date) => (unit === 'week' ? toDateKey(mondayOfWeek(d)) : monthKey(d));
  const step = (d: Date) => {
    if (unit === 'week') d.setUTCDate(d.getUTCDate() - 7);
    else d.setUTCMonth(d.getUTCMonth() - 1);
  };

  const periods = new Set(completedDates.map((k) => keyOf(new Date(k))));
  const createdPeriod = keyOf(createdAt);
  const cursor = new Date();

  if (!periods.has(keyOf(cursor))) step(cursor);

  let streak = 0;
  while (keyOf(cursor) >= createdPeriod) {
    if (!periods.has(keyOf(cursor))) break;
    streak += 1;
    step(cursor);
  }
  return streak;
}

function computeStreak(completedDates: string[], createdAt: Date, freq: HabitFrequency): number {
  if (freq === 'weekly') return computePeriodStreak(completedDates, createdAt, 'week');
  if (freq === 'monthly') return computePeriodStreak(completedDates, createdAt, 'month');
  return computeDailyStreak(completedDates, createdAt, freq);
}

// Monday-start grid for the current calendar week. Days before the habit
// was created are always false — they were never trackable.
function computeWeek(completedDates: string[], createdAt: Date): boolean[] {
  const completed = new Set(completedDates);
  const createdKey = toDateKey(createdAt);
  const monday = mondayOfCurrentWeek();
  const week: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const key = toDateKey(d);
    week.push(key >= createdKey && completed.has(key));
  }
  return week;
}

export function toPublicHabit(doc: HabitDocument) {
  // Habits created before completedDates/createdAt existed on this schema
  // won't have either field populated in the database — fall back to the
  // epoch so legacy habits behave as if always trackable, rather than
  // crashing on a missing Date.
  const createdAt = doc.createdAt ?? new Date(0);
  const completedDates = doc.completedDates ?? [];
  const freq = doc.freq ?? 'daily';
  return {
    id: doc.id as string,
    name: doc.name,
    category: doc.category,
    freq,
    createdAt: createdAt.toISOString(),
    completedDates,
    streak: computeStreak(completedDates, createdAt, freq),
    week: computeWeek(completedDates, createdAt),
    doneToday: completedDates.includes(toDateKey(new Date())),
  };
}

export const Habit = model<HabitDocument>('Habit', habitSchema);
