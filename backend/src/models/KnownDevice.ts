import { Schema, model, Document } from 'mongoose';

// Devices a user has signed in on, so the "new sign-in" email only goes out for
// a device we haven't seen before (see authEmail.controller.ts). deviceId is a
// random id the app generates once per install (utils/deviceId.ts) — not a
// hardware identifier.
export interface KnownDeviceDocument extends Document {
  firebaseUid: string;
  deviceId: string;
  // Human-readable, e.g. "Chris's iPhone · iOS 18.2" — shown in the email.
  label?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const knownDeviceSchema = new Schema<KnownDeviceDocument>({
  firebaseUid: { type: String, required: true, index: true },
  deviceId: { type: String, required: true },
  label: { type: String },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
});

knownDeviceSchema.index({ firebaseUid: 1, deviceId: 1 }, { unique: true });

export const KnownDevice = model<KnownDeviceDocument>('KnownDevice', knownDeviceSchema);
