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
    // Calendar days ('YYYY-MM-DD', UTC) marked done. Streak/week grid are derived
    // from this plus createdAt so tracking starts on the actual creation day.
    completedDates: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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
//
// `today` is the caller's notion of "today" — see toPublicHabit's doc comment
// for why this must come from the client's local calendar day, not the
// server's clock.
function computeDailyStreak(completedDates: string[], createdAt: Date, freq: HabitFrequency, today: Date): number {
  const completed = new Set(completedDates);
  const createdKey = toDateKey(createdAt);
  const cursor = new Date(today);

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
function computePeriodStreak(completedDates: string[], createdAt: Date, unit: 'week' | 'month', today: Date): number {
  const keyOf = (d: Date) => (unit === 'week' ? toDateKey(mondayOfWeek(d)) : monthKey(d));
  const step = (d: Date) => {
    if (unit === 'week') d.setUTCDate(d.getUTCDate() - 7);
    else d.setUTCMonth(d.getUTCMonth() - 1);
  };

  const periods = new Set(completedDates.map((k) => keyOf(new Date(k))));
  const createdPeriod = keyOf(createdAt);
  const cursor = new Date(today);

  if (!periods.has(keyOf(cursor))) step(cursor);

  let streak = 0;
  while (keyOf(cursor) >= createdPeriod) {
    if (!periods.has(keyOf(cursor))) break;
    streak += 1;
    step(cursor);
  }
  return streak;
}

function computeStreak(completedDates: string[], createdAt: Date, freq: HabitFrequency, today: Date): number {
  if (freq === 'weekly') return computePeriodStreak(completedDates, createdAt, 'week', today);
  if (freq === 'monthly') return computePeriodStreak(completedDates, createdAt, 'month', today);
  return computeDailyStreak(completedDates, createdAt, freq, today);
}

// Monday-start grid for the current calendar week. Days before the habit
// was created are always false — they were never trackable.
function computeWeek(completedDates: string[], createdAt: Date, today: Date): boolean[] {
  const completed = new Set(completedDates);
  const createdKey = toDateKey(createdAt);
  const monday = mondayOfWeek(today);
  const week: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const key = toDateKey(d);
    week.push(key >= createdKey && completed.has(key));
  }
  return week;
}

// `todayKey` ('YYYY-MM-DD') is the CLIENT's own local calendar day, passed
// through from the request (see habit.controller.ts) — not derived from the
// server's clock here. The server can run in any timezone (UTC in
// production), so deriving "today" from `new Date()` on this end would make
// streak/week/doneToday flip over at UTC midnight instead of the user's own
// midnight — wrong for every user not in UTC, and more than a rounding
// error: it's a multi-hour window every single day (as large as the user's
// UTC offset) where a toggle could silently record under the wrong day, or
// today's completion could fail to show as done. Defaults to the server's
// own date only when no client date is given (e.g. coachContext.ts's
// internal, non-request-scoped calls, where exact precision isn't load-bearing).
export function toPublicHabit(doc: HabitDocument, todayKey: string = toDateKey(new Date())) {
  // Legacy habits predate completedDates/createdAt on this schema — fall back to
  // epoch so they behave as always-trackable instead of crashing on a missing Date.
  const createdAt = doc.createdAt ?? new Date(0);
  const completedDates = doc.completedDates ?? [];
  const freq = doc.freq ?? 'daily';
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  return {
    id: doc.id as string,
    name: doc.name,
    category: doc.category,
    freq,
    createdAt: createdAt.toISOString(),
    completedDates,
    streak: computeStreak(completedDates, createdAt, freq, today),
    week: computeWeek(completedDates, createdAt, today),
    doneToday: completedDates.includes(todayKey),
  };
}

export const Habit = model<HabitDocument>('Habit', habitSchema);
