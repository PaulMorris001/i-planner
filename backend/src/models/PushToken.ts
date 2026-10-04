import { Schema, model, Document } from 'mongoose';

// One row per app install that can receive push notifications (Expo push
// token, e.g. "ExponentPushToken[...]"). A user signed in on two phones has two
// rows. Tokens Expo reports as no longer valid are deleted by
// services/pushNotifications.ts, so this doesn't fill up with dead installs.
export interface PushTokenDocument extends Document {
  firebaseUid: string;
  token: string;
  platform: 'ios' | 'android';
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<PushTokenDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    // Unique on its own: a phone that signs into a different account moves
    // its token to that account instead of notifying both.
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
  },
  { timestamps: true }
);

export const PushToken = model<PushTokenDocument>('PushToken', pushTokenSchema);
