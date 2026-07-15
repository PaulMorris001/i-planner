import { authedRequest } from './authedRequest';
import type { Settings } from '@/types/settings.types';

export const settingsService = {
  get: () => authedRequest<Settings>('/settings'),

  patch: (update: Partial<Settings> & { timeZone?: string }) =>
    authedRequest<Settings>('/settings', { method: 'PATCH', body: update }),

  startGoogleConnect: () =>
    authedRequest<{ url: string }>('/settings/calendar/google/start', { method: 'POST' }),

  disconnectGoogle: () =>
    authedRequest<Settings>('/settings/calendar/google/disconnect', { method: 'POST' }),
};
