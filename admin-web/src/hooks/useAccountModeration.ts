import { useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import type { AdminUserRow } from '@/lib/types';

export interface AccountAction {
  user: AdminUserRow;
  mode: 'suspend' | 'restore';
}

// The suspend / restore flow for one account at a time: which account and what to do (`action`),
// the optional reason, the in-flight and error state, and the call itself. `onDone` receives the
// account and whether it is now suspended, so the page can update its list in place.
export function useAccountModeration(onDone: (user: AdminUserRow, suspended: boolean, reason?: string) => void) {
  const [action, setAction] = useState<AccountAction | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const begin = (user: AdminUserRow, mode: AccountAction['mode']) => {
    setAction({ user, mode });
    setReason('');
    setError('');
  };

  const cancel = () => {
    // Don't drop the dialog from under a request that is still running.
    if (!acting) setAction(null);
  };

  const confirm = async () => {
    if (!action || acting) return;
    setActing(true);
    setError('');
    try {
      const cleanReason = reason.trim() || undefined;
      if (action.mode === 'suspend') await adminApi.suspend(action.user.uid, cleanReason);
      else await adminApi.restore(action.user.uid);
      const suspended = action.mode === 'suspend';
      setAction(null);
      onDone(action.user, suspended, suspended ? cleanReason : undefined);
    } catch (err) {
      setError(errorMessage(err, 'Could not complete that. Try again.'));
    } finally {
      setActing(false);
    }
  };

  return { action, reason, setReason, acting, error, begin, cancel, confirm };
}
