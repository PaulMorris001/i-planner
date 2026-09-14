export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string; //
  // Locally-scheduled expo-notifications reminder id(s) — a weekly check-in
  // nudge to log a contribution, not tied to targetDate. See
  // utils/notifications.ts's scheduleSavingsGoalNotifications.
  notificationIds?: string[];
}

export interface NewSavingsGoalInput {
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
  notificationIds?: string[];
}
