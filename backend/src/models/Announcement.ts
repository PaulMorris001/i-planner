import { Schema, model, Document } from 'mongoose';

// One announcement sent from the dashboard, with what it reached.
export interface AnnouncementDocument extends Document {
  title: string;
  body: string;
  route?: string;
  sentPush: boolean;
  sentEmail: boolean;
  // A test goes only to the admin who sent it.
  test: boolean;
  pushDevices: number;
  pushAccepted: number;
  emailRecipients: number;
  emailSent: number;
  sentByUid: string;
  sentByEmail?: string;
  createdAt: Date;
}

const announcementSchema = new Schema<AnnouncementDocument>(
  {
    title: { type: String, required: true, maxlength: 80 },
    body: { type: String, required: true, maxlength: 600 },
    route: { type: String },
    sentPush: { type: Boolean, default: false },
    sentEmail: { type: Boolean, default: false },
    test: { type: Boolean, default: false },
    pushDevices: { type: Number, default: 0 },
    pushAccepted: { type: Number, default: 0 },
    emailRecipients: { type: Number, default: 0 },
    emailSent: { type: Number, default: 0 },
    sentByUid: { type: String, required: true },
    sentByEmail: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

announcementSchema.index({ createdAt: -1 });

export const Announcement = model<AnnouncementDocument>('Announcement', announcementSchema);
