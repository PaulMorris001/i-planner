import { authedRequest } from './authedRequest';
import type { Task, NewTaskInput } from '@/types/task.types';

export const taskService = {
  list: () => authedRequest<Task[]>('/tasks'),

  create: (input: NewTaskInput) =>
    authedRequest<Task>('/tasks', { method: 'POST', body: input }),

  update: (id: string, patch: Partial<Task>) =>
    authedRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => authedRequest<void>(`/tasks/${id}`, { method: 'DELETE' }),
};
