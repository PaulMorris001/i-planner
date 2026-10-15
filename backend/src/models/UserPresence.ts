import { Schema, model, Document } from 'mongoose';

// When an account last made an authenticated request: "active now" and daily/weekly activity on
// the admin dashboard. Updated at most once a minute per account.
export interface UserPresenceDocument extends Document {
  firebaseUid: string;
  lastActiveAt: Date;
}

const userPresenceSchema = new Schema<UserPresenceDocument>({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  lastActiveAt: { type: Date, required: true, index: true },
});

export const UserPresence = model<UserPresenceDocument>('UserPresence', userPresenceSchema);
