import { Schema, model, Document } from 'mongoose';

// A suspended account: refused by requireAuth on every request (see services/accountStatus.ts),
// on top of being disabled in Firebase so it cannot sign in again.
export interface AccountSuspensionDocument extends Document {
  firebaseUid: string;
  reason?: string;
  suspendedByUid: string;
  createdAt: Date;
}

const accountSuspensionSchema = new Schema<AccountSuspensionDocument>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    reason: { type: String, maxlength: 300 },
    suspendedByUid: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AccountSuspension = model<AccountSuspensionDocument>('AccountSuspension', accountSuspensionSchema);
