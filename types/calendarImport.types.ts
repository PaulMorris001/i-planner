export type CalendarSource = 'apple' | 'google';

export interface ImportedCalendarEvent {
  id: string;
  // The actual calendar-provider event id (expo-calendar's or Google's own)
  // — use THIS, not `id`, when linking a converted task to the same event.
  externalId: string;
  source: CalendarSource;
  title: string;
  startAt: string; // ISO instant
  endAt: string;
  allDay: boolean;
  location?: string;
}
