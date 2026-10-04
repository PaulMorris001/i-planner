export interface Settings {
  appleCalendarConnected: boolean;
  googleCalendarConnected: boolean;
  outlookCalendarConnected: boolean;
  // Access was revoked/expired on the provider side and the backend turned the
  // connection off — show "Reconnect needed" instead of "Not connected".
  googleReauthRequired?: boolean;
  outlookReauthRequired?: boolean;
  calendarGateDismissed: boolean;
  remindersEnabled: boolean;
  aiAccessTasks: boolean;
  aiAccessGoals: boolean;
  aiAccessCalendar: boolean;
  aiDisclosureAcknowledged: boolean;
  savingsDisclosureAcknowledged: boolean;
  focusProfile?: string;
  // Opted in to push announcements (new features, updates).
  productUpdatesEnabled?: boolean;
}
