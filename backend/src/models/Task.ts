import { Schema, model, Document } from 'mongoose';

export interface TaskDocument extends Document {
  firebaseUid: string;
  title: string;
  category: string;
  priority: string;
  day: number;
  hour: number;
  time: string;
  dueDate: string;
  // Authoritative completion state only for a one-time task (recurring is
  // false). A recurring task's per-occurrence completion lives in
  // completedDates instead — this field isn't meaningful per-occurrence for
  // it, since one Task document represents every occurrence.
  done: boolean;
  recurring: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  // Local "YYYY-MM-DD" dates this recurring task was marked done on — same
  // pattern as Habit.completedDates, for the same reason: one Task document
  // represents every weekday it recurs on, so completion has to be tracked
  // per calendar date instead of a single shared boolean, or completing
  // today's occurrence would show every other occurrence as done too. Only
  // meaningful when recurring is true.
  completedDates?: string[];
  notes: string;
  appleEventIds?: string[];
  googleEventId?: string;
  // Locally-scheduled expo-notifications reminder ids (client-side only — the
  // backend never schedules or sends these, it just persists the ids so the app
  // can find and cancel/reschedule them later). One per weekday occurrence for a
  // 'weekdays' task, same array-per-occurrence reasoning as appleEventIds.
  notificationIds?: string[];
}

const taskSchema = new Schema<TaskDocument>({
  firebaseUid: { type: String, required: true, index: true },
  // category/priority are free-form strings rather than a Mongoose enum —
  // the canonical list lives in the frontend's constants/taskMeta.ts and this
  // backend doesn't share a types package with the app.
  category: { type: String, required: true },
  priority: { type: String, required: true },
  day: { type: Number, required: true },
  hour: { type: Number, required: true },
  time: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  done: { type: Boolean, default: false },
  recurring: { type: Boolean, default: false },
  // Only meaningful when recurring is true — see types/task.types.ts's TaskFrequency.
  freq: { type: String },
  dayIdxs: { type: [Number] },
  completedDates: { type: [String] },
  notes: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  // Calendar-sync event ids — only ever set when dueDate is non-empty.
  appleEventIds: { type: [String] },
  googleEventId: { type: String },
  notificationIds: { type: [String] },
});

export function toPublicTask(doc: TaskDocument) {
  return {
    id: doc.id as string,
    title: doc.title,
    category: doc.category,
    priority: doc.priority,
    day: doc.day,
    hour: doc.hour,
    time: doc.time,
    dueDate: doc.dueDate,
    done: doc.done,
    recurring: doc.recurring,
    freq: doc.freq,
    dayIdxs: doc.dayIdxs,
    completedDates: doc.completedDates,
    notes: doc.notes,
    appleEventIds: doc.appleEventIds,
    googleEventId: doc.googleEventId,
    notificationIds: doc.notificationIds,
  };
}

export const Task = model<TaskDocument>('Task', taskSchema);
