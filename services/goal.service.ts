import { authedRequest } from './authedRequest';
import type { Goal, NewGoalInput } from '@/types/goal.types';

export const goalService = {
  list: () => authedRequest<Goal[]>('/goals'),

  create: (input: NewGoalInput) =>
    authedRequest<Goal>('/goals', { method: 'POST', body: input }),

  update: (id: string, patch: Partial<Goal>) =>
    authedRequest<Goal>(`/goals/${id}`, { method: 'PATCH', body: patch }),
};
