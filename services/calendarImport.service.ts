import { authedRequest } from './authedRequest';
import type { ImportedCalendarEvent } from '@/types/calendarImport.types';

export interface AppleEventInput {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

export const calendarImportService = {
  list: () => authedRequest<ImportedCalendarEvent[]>('/calendar/imported'),

  importGoogle: () =>
    authedRequest<ImportedCalendarEvent[]>('/calendar/import/google', { method: 'POST' }),

  importApple: (events: AppleEventInput[]) =>
    authedRequest<ImportedCalendarEvent[]>('/calendar/import/apple', {
      method: 'POST',
      body: { events },
    }),

  // Used both to dismiss an event and, after converting one to a task, to
  // remove the now-redundant imported-event row.
  remove: (id: string) => authedRequest<void>(`/calendar/imported/${id}`, { method: 'DELETE' }),
};
