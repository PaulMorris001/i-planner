export interface SavingsGoal {
  name: string;
  targetAmount: number;
  savedAmount: number;
  // Free text (e.g. "Jun 2027"), not a real date — matches FinancialGoal's
  // targetYear precedent for this same kind of loose, unpicked date field.
  targetDate: string;
}

export interface Settings {
  appleCalendarConnected: boolean;
  googleCalendarConnected: boolean;
  calendarGateDismissed: boolean;
  remindersEnabled: boolean;
  aiAccessTasks: boolean;
  aiAccessGoals: boolean;
  aiAccessCalendar: boolean;
  aiDisclosureAcknowledged: boolean;
  savingsDisclosureAcknowledged: boolean;
  // Shared across all three dashboards, not tied to a path — a user only ever
  // sees one dashboard at a time, so there's no reason for it to live on any
  // one plan document.
  savingsGoal?: SavingsGoal;
}
