import { authedRequest } from './authedRequest';
import type { Goal, GoalTypeId, MilestonePatch, NewGoalInput } from '@/types/goal.types';

// Milestones a caller sends in an update may include ones just added in the
// same edit, which don't have a real id yet — the backend assigns one.
type GoalUpdateBody = Partial<Omit<Goal, 'milestones'>> & { milestones?: MilestonePatch[] };

export const goalService = {
  list: () => authedRequest<Goal[]>('/goals'),

  create: (input: NewGoalInput) =>
    authedRequest<Goal>('/goals', { method: 'POST', body: input }),

  update: (id: string, patch: GoalUpdateBody) =>
    authedRequest<Goal>(`/goals/${id}`, { method: 'PATCH', body: patch }),

  generateMilestones: (input: { title: string; type: GoalTypeId }) =>
    authedRequest<{ milestones: { title: string; dueLabel: string }[] }>(
      '/goals/generate-milestones',
      { method: 'POST', body: input }
    ),

  remove: (id: string) => authedRequest<void>(`/goals/${id}`, { method: 'DELETE' }),
};
