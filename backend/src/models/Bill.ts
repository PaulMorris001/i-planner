import { Schema, model, Document } from 'mongoose';

export const BILL_CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'loans', 'other'] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];

export interface BillDocument extends Document {
  firebaseUid: string;
  name: string;
  amount: number;
  dueDate: string; // "YYYY-MM-DD" — day-of-month is what matters for a recurring bill.
  recurring: boolean;
  category: BillCategory;
  // Local expo-notifications reminder ids — one lead (3 days before) + one on the
  // due date, same pairing as scheduleTaskNotifications/scheduleClassNotifications.
  notificationIds?: string[];
}

const billSchema = new Schema<BillDocument>({
  firebaseUid: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  dueDate: { type: String, required: true },
  recurring: { type: Boolean, default: false },
  category: { type: String, enum: BILL_CATEGORIES, default: 'other' },
  notificationIds: { type: [String] },
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
  };
}

export const Bill = model<BillDocument>('Bill', billSchema);
