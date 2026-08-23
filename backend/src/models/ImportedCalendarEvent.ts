import { Schema, model, Document } from 'mongoose';

export type CalendarSource = 'apple' | 'google';

export interface ImportedCalendarEventDocument extends Document {
  firebaseUid: string;
  source: CalendarSource;
  // The source calendar's own event id — apple's expo-calendar id or google's
  // Calendar API event id. Scoped per (firebaseUid, source) rather than
  // globally unique, since apple/google id spaces are independent. Used both
  // to upsert on re-import (don't duplicate a row for an event already seen)
  // and, on convert, copied onto the new Task's appleEventIds/googleEventId
  // so the task points at the existing calendar event instead of a new one.
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
    // The actual calendar-provider event id — required for "convert to
    // task" to link the new task to the SAME event (see NewTaskModal's
    // draft.appleEventIds/googleEventId). `id` above is only this row's own
    // Mongo document id, meaningless to expo-calendar/the Google API.
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
