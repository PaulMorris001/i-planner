import { Schema, model, Document } from 'mongoose';

export interface SettingsDocument extends Document {
  firebaseUid: string;
  appleCalendarConnected: boolean;
  googleCalendarConnected: boolean;
  calendarGateDismissed: boolean;
  // Gates local notifications for both tasks and classes with a due/start date+time.
  remindersEnabled: boolean;
  // Google OAuth tokens — never exposed via toPublicSettings(). The client secret
  // for the Google OAuth client itself lives only in backend env, not here.
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: Date;
  // Id of the dedicated secondary "i-Planner" Google Calendar synced events are
  // written to (created on first sync) — keeps synced events isolated from the
  // user's primary calendar. Not exposed via toPublicSettings(); purely internal.
  googleCalendarId?: string;
  // IANA timezone captured from the device (e.g. "America/New_York") — used so
  // synced Google Calendar events land at the correct local hour instead of UTC.
  timeZone?: string;
  // AI Coach data-access consent (Profile page's "AI Data Access" toggles) —
  // gates which sections coachContext.ts includes when building the Coach's
  // context summary. Undefined (pre-existing users) is treated as true, since
  // the toggles default to on.
  aiAccessTasks?: boolean;
  aiAccessGoals?: boolean;
  aiAccessCalendar?: boolean;
}

const settingsSchema = new Schema<SettingsDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  appleCalendarConnected: { type: Boolean, default: false },
  googleCalendarConnected: { type: Boolean, default: false },
  calendarGateDismissed: { type: Boolean, default: false },
  remindersEnabled: { type: Boolean, default: false },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleTokenExpiresAt: { type: Date },
  googleCalendarId: { type: String },
  timeZone: { type: String },
  aiAccessTasks: { type: Boolean, default: true },
  aiAccessGoals: { type: Boolean, default: true },
  aiAccessCalendar: { type: Boolean, default: true },
});

export function toPublicSettings(doc: SettingsDocument | null) {
  return {
    appleCalendarConnected: doc?.appleCalendarConnected ?? false,
    googleCalendarConnected: doc?.googleCalendarConnected ?? false,
    calendarGateDismissed: doc?.calendarGateDismissed ?? false,
    remindersEnabled: doc?.remindersEnabled ?? false,
    aiAccessTasks: doc?.aiAccessTasks ?? true,
    aiAccessGoals: doc?.aiAccessGoals ?? true,
    aiAccessCalendar: doc?.aiAccessCalendar ?? true,
  };
}

export const Settings = model<SettingsDocument>('Settings', settingsSchema);
