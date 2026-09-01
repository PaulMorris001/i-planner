export type BillCategory = 'housing' | 'utilities' | 'subscriptions' | 'insurance' | 'loans' | 'other';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // "YYYY-MM-DD" — day-of-month is what matters for a recurring bill.
  recurring: boolean;
  category: BillCategory;
  notificationIds?: string[];
  // "YYYY-MM-DD" date-key of the recurring cycle last marked paid — see
  // Bill.ts's backend doc comment for the full "resets automatically" reasoning.
  lastPaidCycle?: string;
}

export interface NewBillInput {
  name: string;
  amount: number;
  dueDate: string;
  recurring: boolean;
  category: BillCategory;
  notificationIds?: string[];
  lastPaidCycle?: string;
}
