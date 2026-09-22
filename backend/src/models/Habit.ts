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
    category: { type: String, required: true },
    freq: { type: String, enum: ['daily', 'weekdays', 'weekly', 'monthly'], default: 'daily' },
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

export function toPublicHabit(doc: HabitDocument, todayKey: string = toDateKey(new Date())) {
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
