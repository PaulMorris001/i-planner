import { authedRequest } from './authedRequest';
import type { Habit, NewHabitInput } from '@/types/habit.types';

export const habitService = {
  list: () => authedRequest<Habit[]>('/habits'),

  create: (input: NewHabitInput) =>
    authedRequest<Habit>('/habits', { method: 'POST', body: input }),

  toggleToday: (id: string) =>
    authedRequest<Habit>(`/habits/${id}/toggle-today`, { method: 'PATCH' }),

  update: (id: string, patch: Partial<NewHabitInput>) =>
    authedRequest<Habit>(`/habits/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => authedRequest<void>(`/habits/${id}`, { method: 'DELETE' }),
};
