import { Schema, model, Document } from 'mongoose';

export interface SettingsDocument extends Document {
  firebaseUid: string;
  appleCalendarConnected: boolean;
  googleCalendarConnected: boolean;
  calendarGateDismissed: boolean;
  // Gates local notifications for both tasks and classes with a due/start date+time.
  remindersEnabled: boolean;
  // Never exposed via toPublicSettings(). Encrypted at rest (utils/tokenCrypto.ts) —
  // always encryptToken()/decryptToken(), never store or use the raw value.
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: Date;
  // Id of the dedicated secondary "i-Planner" Google Calendar synced events go to,
  // keeping them isolated from the user's primary calendar. Internal only.
  googleCalendarId?: string;
  // IANA timezone from the device — synced events land at the correct local hour
  // instead of UTC.
  timeZone?: string;
  // AI Coach data-access consent, gates what coachContext.ts includes. Undefined
  // (pre-existing users) treated as true since the toggles default on.
  aiAccessTasks?: boolean;
  aiAccessGoals?: boolean;
  aiAccessCalendar?: boolean;
  // Set once the user taps through AiDisclosureGate — coach.controller.ts refuses
  // to call OpenAI until true. Required by App Store guideline 5.1.2(i): consent
  // must precede sending data, not just be revocable after via aiAccess* above.
  aiDisclosureAcknowledged?: boolean;
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
  aiDisclosureAcknowledged: { type: Boolean, default: false },
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
    aiDisclosureAcknowledged: doc?.aiDisclosureAcknowledged ?? false,
  };
}

export const Settings = model<SettingsDocument>('Settings', settingsSchema);
