import { Schema, model, Document } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  institution?: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  institution: { type: String, trim: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const User = model<UserDocument>('User', userSchema);

export function toPublicUser(doc: UserDocument) {
  return {
    id: doc.id as string,
    email: doc.email,
    fullName: doc.fullName,
    institution: doc.institution,
    createdAt: doc.createdAt.toISOString(),
  };
}
