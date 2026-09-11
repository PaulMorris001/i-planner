import { authedRequest } from './authedRequest';
import { toDateKey } from '@/utils/date';
import type { Habit, NewHabitInput } from '@/types/habit.types';

// The device's own local calendar day — sent with every habit request so the
// backend's streak/week/doneToday math (and the toggle write itself) anchors
// to the user's actual "today" instead of the server's UTC clock. Without
// this, a user outside UTC gets a multi-hour window every day (as wide as
// their UTC offset) where a toggle can silently land on the wrong date. See
// backend/src/models/Habit.ts's toPublicHabit doc comment.
function localDate(): string {
  return toDateKey(new Date());
}

export const habitService = {
  list: () => authedRequest<Habit[]>(`/habits?localDate=${localDate()}`),

  create: (input: NewHabitInput) =>
    authedRequest<Habit>('/habits', { method: 'POST', body: { ...input, localDate: localDate() } }),

  toggleToday: (id: string) =>
    authedRequest<Habit>(`/habits/${id}/toggle-today`, { method: 'PATCH', body: { localDate: localDate() } }),

  update: (id: string, patch: Partial<NewHabitInput>) =>
    authedRequest<Habit>(`/habits/${id}`, { method: 'PATCH', body: { ...patch, localDate: localDate() } }),

  remove: (id: string) => authedRequest<void>(`/habits/${id}`, { method: 'DELETE' }),
};
