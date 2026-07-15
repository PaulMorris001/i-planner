import { Schema, model, Document } from 'mongoose';

export interface SettingsDocument extends Document {
  firebaseUid: string;
  appleCalendarConnected: boolean;
  googleCalendarConnected: boolean;
  calendarGateDismissed: boolean;
  // Google OAuth tokens — never exposed via toPublicSettings(). The client secret
  // for the Google OAuth client itself lives only in backend env, not here.
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: Date;
  // Id of the dedicated secondary "i-Planner" Google Calendar synced events are
  // written to (created on first sync) — keeps synced events isolated from the
  // user's primary calendar. Not exposed via toPublicSettings(); purely internal.
  googleCalendarId?: string;
}

const settingsSchema = new Schema<SettingsDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  appleCalendarConnected: { type: Boolean, default: false },
  googleCalendarConnected: { type: Boolean, default: false },
  calendarGateDismissed: { type: Boolean, default: false },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleTokenExpiresAt: { type: Date },
  googleCalendarId: { type: String },
});

export function toPublicSettings(doc: SettingsDocument | null) {
  return {
    appleCalendarConnected: doc?.appleCalendarConnected ?? false,
    googleCalendarConnected: doc?.googleCalendarConnected ?? false,
    calendarGateDismissed: doc?.calendarGateDismissed ?? false,
  };
}

export const Settings = model<SettingsDocument>('Settings', settingsSchema);
