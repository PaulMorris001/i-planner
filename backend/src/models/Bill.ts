import { Schema, model, Document } from 'mongoose';

export const BILL_CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'loans', 'other'] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];

export interface BillDocument extends Document {
  firebaseUid: string;
  name: string;
  amount: number;
  dueDate: string; 
  recurring: boolean;
  category: BillCategory;
  notificationIds?: string[];
  lastPaidCycle?: string;
}

const billSchema = new Schema<BillDocument>({
  firebaseUid: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  dueDate: { type: String, required: true },
  recurring: { type: Boolean, default: false },
  category: { type: String, enum: BILL_CATEGORIES, default: 'other' },
  notificationIds: { type: [String] },
  lastPaidCycle: { type: String },
});

export function toPublicBill(doc: BillDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    amount: doc.amount,
    dueDate: doc.dueDate,
    recurring: doc.recurring,
    category: doc.category,
    notificationIds: doc.notificationIds,
    lastPaidCycle: doc.lastPaidCycle,
  };
}

export const Bill = model<BillDocument>('Bill', billSchema);
