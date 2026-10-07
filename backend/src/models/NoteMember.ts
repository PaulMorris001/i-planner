import { Schema, model, Document } from 'mongoose';
import { NOTE_ROLES, NoteRole } from '../constants/collaboration';

export type MemberStatus = 'pending' | 'accepted' | 'declined';

// One row per person invited to one note. The invitation is tied to the EMAIL it was sent to;
// when someone accepts, the row is bound to the account that accepted (memberUid).
//
// The emailed link carries a secret token. Only its SHA-256 hash is stored, so a copy of the
// database cannot be used to accept anyone's invitation.
export interface NoteMemberDocument extends Document {
  noteId: string;
  // The note's owner at the time of the invite (denormalised so access checks and cleanup
  // don't need to load the note).
  ownerUid: string;
  // Lower-cased address the invitation was sent to.
  email: string;
  role: NoteRole;
  status: MemberStatus;
  // Set when the invitation is accepted: the account that now has access.
  memberUid?: string;
  tokenHash: string;
  expiresAt: Date;
  // Who invited them, as shown in the email and to the invitee ("Sam" or an address).
  inviterLabel: string;
  sendCount: number;
  lastSentAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const noteMemberSchema = new Schema<NoteMemberDocument>(
  {
    noteId: { type: String, required: true, index: true },
    ownerUid: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: NOTE_ROLES, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], required: true, default: 'pending' },
    memberUid: { type: String },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    inviterLabel: { type: String, required: true },
    sendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, required: true },
    respondedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// One invitation row per note + email (re-inviting reuses the row with a fresh token).
noteMemberSchema.index({ noteId: 1, email: 1 }, { unique: true });
// An account can only be an accepted member of a note once, however many invitations it got.
noteMemberSchema.index({ noteId: 1, memberUid: 1 }, { unique: true, partialFilterExpression: { status: 'accepted' } });
// "Notes shared with me".
noteMemberSchema.index({ memberUid: 1, status: 1 });

export const NoteMember = model<NoteMemberDocument>('NoteMember', noteMemberSchema);
