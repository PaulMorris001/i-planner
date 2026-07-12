import { authedRequest } from './authedRequest';
import type { Settings } from '@/types/settings.types';

export const settingsService = {
  get: () => authedRequest<Settings>('/settings'),

  patch: (update: Partial<Settings>) =>
    authedRequest<Settings>('/settings', { method: 'PATCH', body: update }),
};
