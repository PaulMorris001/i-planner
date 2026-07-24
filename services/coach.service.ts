import { authedRequest } from './authedRequest';
import type { CoachMessage, CoachModeId, CoachSendResult } from '@/types/coach.types';

export const coachService = {
  list: (mode: CoachModeId) => authedRequest<CoachMessage[]>(`/coach/${mode}`),

  send: (mode: CoachModeId, content: string) =>
    authedRequest<CoachSendResult>(`/coach/${mode}`, { method: 'POST', body: { content } }),
};
