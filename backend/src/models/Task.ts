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
  // Authoritative only for a one-time task. A recurring task shares one Task
  // document across every occurrence, so per-occurrence completion lives in
  // completedDates instead.
  done: boolean;
  recurring: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  // Local "YYYY-MM-DD" dates this recurring task was completed on (same pattern
  // as Habit.completedDates) — otherwise completing one occurrence would mark
  // every other occurrence done too. Only meaningful when recurring is true.
  completedDates?: string[];
  notes: string;
  appleEventIds?: string[];
  googleEventId?: string;
  // Client-scheduled expo-notifications reminder ids — backend just persists them
  // so the app can find and cancel/reschedule later. One per weekday occurrence.
  notificationIds?: string[];
  // Set at creation when converted from an ImportedCalendarEvent — appleEventIds/
  // googleEventId then point at a real pre-existing event the app doesn't own.
  // When true, edits must never delete/recreate that event, only the app's own
  // copy of the details (see task.controller.ts's updateTask).
  calendarLinkExternal?: boolean;
  // When true, the due-time notification (not the 15-min lead) rings as a
  // louder alarm — custom sound, bypasses Do Not Disturb — instead of a
  // normal notification. See utils/notifications.ts's scheduleTaskNotifications.
  alarmEnabled?: boolean;
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
  calendarLinkExternal: { type: Boolean, default: false },
  alarmEnabled: { type: Boolean, default: false },
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
    calendarLinkExternal: doc.calendarLinkExternal,
    alarmEnabled: doc.alarmEnabled,
  };
}

export const Task = model<TaskDocument>('Task', taskSchema);
