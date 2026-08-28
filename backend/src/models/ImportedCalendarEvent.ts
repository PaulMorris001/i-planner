import { Schema, model, Document } from 'mongoose';

export type CalendarSource = 'apple' | 'google';

export interface ImportedCalendarEventDocument extends Document {
  firebaseUid: string;
  source: CalendarSource;
  // Source calendar's own event id (expo-calendar id or Google Calendar API id).
  // Scoped per (firebaseUid, source), not globally unique, since apple/google id
  // spaces are independent. Used to upsert on re-import and, on convert, copied
  // onto the new Task so it points at the existing event instead of a new one.
  externalId: string;
  title: string;
  startAt: string; // ISO instant
  endAt: string;   // ISO instant
  allDay: boolean;
  location?: string;
}

const importedCalendarEventSchema = new Schema<ImportedCalendarEventDocument>({
  firebaseUid: { type: String, required: true, index: true },
  source: { type: String, enum: ['apple', 'google'], required: true },
  externalId: { type: String, required: true },
  title: { type: String, required: true },
  startAt: { type: String, required: true },
  endAt: { type: String, required: true },
  allDay: { type: Boolean, default: false },
  location: { type: String },
});

importedCalendarEventSchema.index({ firebaseUid: 1, source: 1, externalId: 1 }, { unique: true });

export function toPublicImportedCalendarEvent(doc: ImportedCalendarEventDocument) {
  return {
    id: doc.id as string,
    // Calendar-provider event id, needed to link a converted task to the SAME
    // event — `id` above is just this row's Mongo id, meaningless to the provider.
    externalId: doc.externalId,
    source: doc.source,
    title: doc.title,
    startAt: doc.startAt,
    endAt: doc.endAt,
    allDay: doc.allDay,
    location: doc.location,
  };
}

export const ImportedCalendarEvent = model<ImportedCalendarEventDocument>(
  'ImportedCalendarEvent',
  importedCalendarEventSchema
);
