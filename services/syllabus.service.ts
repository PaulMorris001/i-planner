import { authedRequest } from './authedRequest';
import type { Syllabus, SyllabusExtractionResult } from '@/types/syllabus.types';

export const syllabusService = {
  list: () => authedRequest<Syllabus[]>('/syllabi'),

  extract: (input: { fileBase64: string; filename: string }) =>
    authedRequest<SyllabusExtractionResult>('/syllabi/extract', { method: 'POST', body: input }),

  create: (input: { fileName: string; courseName: string; classId?: string }) =>
    authedRequest<Syllabus>('/syllabi', { method: 'POST', body: input }),
};
