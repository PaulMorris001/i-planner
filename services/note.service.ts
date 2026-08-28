import { authedRequest } from './authedRequest';
import type { Note, NewNoteInput } from '@/types/note.types';

export const noteService = {
  list: () => authedRequest<Note[]>('/notes'),

  create: (input: NewNoteInput) =>
    authedRequest<Note>('/notes', { method: 'POST', body: input }),

  update: (id: string, patch: Partial<NewNoteInput>) =>
    authedRequest<Note>(`/notes/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => authedRequest<void>(`/notes/${id}`, { method: 'DELETE' }),
};
