import { authedRequest } from './authedRequest';
import type { SavingsGoal, NewSavingsGoalInput } from '@/types/savingsGoal.types';

export const savingsGoalService = {
  list: () => authedRequest<SavingsGoal[]>('/savings-goals'),

  create: (input: NewSavingsGoalInput) =>
    authedRequest<SavingsGoal>('/savings-goals', { method: 'POST', body: input }),

  update: (id: string, patch: Partial<NewSavingsGoalInput>) =>
    authedRequest<SavingsGoal>(`/savings-goals/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => authedRequest<void>(`/savings-goals/${id}`, { method: 'DELETE' }),
};
