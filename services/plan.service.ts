import { authedRequest } from './authedRequest';
import type { StudentPlan, ExamPlan, ProfessionalPlan, ExamTopic } from '@/types/plan.types';

type PathType = 'student' | 'exam' | 'professional';

export const planService = {
  get: async <T>(pathType: PathType): Promise<T | null> => {
    const res = await authedRequest<{ data: T | null }>(`/plans/${pathType}`);
    return res.data;
  },

  save: async <T extends StudentPlan | ExamPlan | ProfessionalPlan>(
    pathType: PathType,
    data: T
  ): Promise<T> => {
    const res = await authedRequest<{ data: T }>(`/plans/${pathType}`, {
      method: 'PUT',
      body: { data },
    });
    return res.data;
  },

  generateExamTopics: async (input: {
    name: string;
    subject: string;
    hoursPerWeek: number;
    weeksRemaining: number;
  }): Promise<Omit<ExamTopic, 'id' | 'done'>[]> => {
    const res = await authedRequest<{ topics: Omit<ExamTopic, 'id' | 'done'>[] }>(
      '/plans/exam/generate-topics',
      { method: 'POST', body: input }
    );
    return res.topics;
  },
};
