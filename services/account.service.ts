import { authedRequest } from './authedRequest';

export const accountService = {
  deleteData: () => authedRequest<void>('/account', { method: 'DELETE' }),
};
