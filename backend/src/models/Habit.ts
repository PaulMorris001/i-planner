import { Schema, model, Document } from 'mongoose';

export interface HabitDocument extends Document {
  firebaseUid: string;
  name: string;
  category: string;
  completedDates: string[];
  createdAt: Date;
}

const habitSchema = new Schema<HabitDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Free-form string, canonical list lives in the frontend's constants/taskMeta.ts.
    category: { type: String, required: true },
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

// Consecutive completed days counting back from today, stopping at the
// first gap or at the habit's creation day — whichever comes first. Today
// itself isn't required to be done yet (grace day) so the streak doesn't
// zero out the instant a new day starts.
function computeStreak(completedDates: string[], createdAt: Date): number {
  const completed = new Set(completedDates);
  const createdKey = toDateKey(createdAt);
  const cursor = new Date();
  if (!completed.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (toDateKey(cursor) >= createdKey && completed.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
  return {
    id: doc.id as string,
    name: doc.name,
    category: doc.category,
    createdAt: createdAt.toISOString(),
    completedDates,
    streak: computeStreak(completedDates, createdAt),
    week: computeWeek(completedDates, createdAt),
    doneToday: completedDates.includes(toDateKey(new Date())),
  };
}

export const Habit = model<HabitDocument>('Habit', habitSchema);
