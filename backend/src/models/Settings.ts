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
}

const settingsSchema = new Schema<SettingsDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  appleCalendarConnected: { type: Boolean, default: false },
  googleCalendarConnected: { type: Boolean, default: false },
  calendarGateDismissed: { type: Boolean, default: false },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleTokenExpiresAt: { type: Date },
});

export function toPublicSettings(doc: SettingsDocument | null) {
  return {
    appleCalendarConnected: doc?.appleCalendarConnected ?? false,
    googleCalendarConnected: doc?.googleCalendarConnected ?? false,
    calendarGateDismissed: doc?.calendarGateDismissed ?? false,
  };
}

export const Settings = model<SettingsDocument>('Settings', settingsSchema);
