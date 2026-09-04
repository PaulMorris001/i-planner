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
  // Chosen on the Focus onboarding screen — synced so Login can restore it on
  // a fresh install instead of silently defaulting to "professional".
  focusProfile?: string;
}
