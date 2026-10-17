import { Schema, model, Document } from 'mongoose';

// One message in a person's in-app notification inbox: what the server sent them (an announcement
// from the admin dashboard, an invitation answer, an access change...). Reminders and alarms that
// the phone schedules for itself never come through here.
export interface InboxNotificationDocument extends Document {
  firebaseUid: string;
  kind: string;
  title: string;
  body: string;
  // In-app screen to open when it is tapped, e.g. /notes.
  route?: string;
  readAt?: Date;
  createdAt: Date;
}

const inboxNotificationSchema = new Schema<InboxNotificationDocument>(
  {
    firebaseUid: { type: String, required: true },
    kind: { type: String, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 700 },
    route: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inboxNotificationSchema.index({ firebaseUid: 1, createdAt: -1 });
// Old messages tidy themselves away after 90 days.
inboxNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const InboxNotification = model<InboxNotificationDocument>('InboxNotification', inboxNotificationSchema);
