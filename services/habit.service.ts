import type { Habit, NewHabitInput } from "@/types/habit.types";
import { toDateKey } from "@/utils/date";
import { authedRequest } from "./authedRequest";

function localDate(): string {
  return toDateKey(new Date());
}

export const habitService = {
  list: () => authedRequest<Habit[]>(`/habits?localDate=${localDate()}`),

  create: (input: NewHabitInput) =>
    authedRequest<Habit>("/habits", {
      method: "POST",
      body: { ...input, localDate: localDate() },
    }),

  toggleToday: (id: string) =>
    authedRequest<Habit>(`/habits/${id}/toggle-today`, {
      method: "PATCH",
      body: { localDate: localDate() },
    }),

  update: (id: string, patch: Partial<NewHabitInput>) =>
    authedRequest<Habit>(`/habits/${id}`, {
      method: "PATCH",
      body: { ...patch, localDate: localDate() },
    }),

  remove: (id: string) =>
    authedRequest<void>(`/habits/${id}`, { method: "DELETE" }),
};
