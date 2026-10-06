import { Schema, model, Document } from 'mongoose';

// A reusable "study session" the person creates once (e.g. "Maths revision") and
// starts whenever they like, as often as they like. The optional schedule only
// drives a reminder and the automatic stop time; it never limits when it can be used.
export interface StudySessionDocument extends Document {
  firebaseUid: string;
  name: string;
  // Monday-start weekday indices (0=Mon..6=Sun) the reminder repeats on. Empty = no schedule.
  days: number[];
  // Minutes after local midnight, e.g. 17:00 = 1020. Both set together, or neither.
  startMinute?: number;
  endMinute?: number;
  // Ids of the reminder notifications scheduled on the device (client-managed).
  notificationIds?: string[];
}

const studySessionSchema = new Schema<StudySessionDocument>({
  firebaseUid: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  days: { type: [Number], default: [] },
  startMinute: { type: Number, min: 0, max: 1439 },
  endMinute: { type: Number, min: 0, max: 1439 },
  notificationIds: { type: [String] },
});

export function toPublicStudySession(doc: StudySessionDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    days: doc.days ?? [],
    startMinute: doc.startMinute ?? null,
    endMinute: doc.endMinute ?? null,
    notificationIds: doc.notificationIds,
  };
}

export const StudySession = model<StudySessionDocument>('StudySession', studySessionSchema);
