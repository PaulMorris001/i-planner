import { authedRequest } from './authedRequest';
import type { Settings, SavingsGoal } from '@/types/settings.types';

export const settingsService = {
  get: () => authedRequest<Settings>('/settings'),

  // savingsGoal accepts `null` on top of Settings' own `SavingsGoal | undefined` —
  // omitting the key means "leave untouched", `null` explicitly means "remove".
  // Omit<> first: intersecting Partial<Settings> (savingsGoal?: SavingsGoal | undefined)
  // directly with a wider savingsGoal type collapses to their intersection, not
  // union, silently excluding `null` again.
  patch: (update: Omit<Partial<Settings>, 'savingsGoal'> & { timeZone?: string; savingsGoal?: SavingsGoal | null }) =>
    authedRequest<Settings>('/settings', { method: 'PATCH', body: update }),

  startGoogleConnect: () =>
    authedRequest<{ url: string }>('/settings/calendar/google/start', { method: 'POST' }),

  disconnectGoogle: () =>
    authedRequest<Settings>('/settings/calendar/google/disconnect', { method: 'POST' }),
};
