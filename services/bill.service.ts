import { authedRequest } from './authedRequest';
import type { Bill, NewBillInput } from '@/types/bill.types';

export const billService = {
  list: () => authedRequest<Bill[]>('/bills'),

  create: (input: NewBillInput) =>
    authedRequest<Bill>('/bills', { method: 'POST', body: input }),

  update: (id: string, patch: Partial<NewBillInput>) =>
    authedRequest<Bill>(`/bills/${id}`, { method: 'PATCH', body: patch }),

  remove: (id: string) => authedRequest<void>(`/bills/${id}`, { method: 'DELETE' }),
};
