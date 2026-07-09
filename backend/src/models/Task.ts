import { Schema, model, Document } from 'mongoose';

export interface TaskDocument extends Document {
  firebaseUid: string;
  title: string;
  category: string;
  priority: string;
  day: number;
  hour: number;
  time: string;
  done: boolean;
  recurring: boolean;
  notes: string;
}

const taskSchema = new Schema<TaskDocument>({
  firebaseUid: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  // category/priority are free-form strings rather than a Mongoose enum —
  // the canonical list lives in the frontend's constants/taskMeta.ts and this
  // backend doesn't share a types package with the app.
  category: { type: String, required: true },
  priority: { type: String, required: true },
  day: { type: Number, required: true },
  hour: { type: Number, required: true },
  time: { type: String, default: '' },
  done: { type: Boolean, default: false },
  recurring: { type: Boolean, default: false },
  notes: { type: String, default: '' },
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
    done: doc.done,
    recurring: doc.recurring,
    notes: doc.notes,
  };
}

export const Task = model<TaskDocument>('Task', taskSchema);
