import { authedRequest } from './authedRequest';

export const accountService = {
  // Wipes all app data (tasks, goals, habits, settings, plans, coach history)
  // owned by the current user. Does not touch the Firebase Auth account itself
  // — that's deleted client-side afterward, see hooks/useAuth.ts's deleteAccount.
  deleteData: () => authedRequest<void>('/account', { method: 'DELETE' }),
};
