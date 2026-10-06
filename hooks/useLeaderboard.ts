import { useCallback, useEffect, useState } from 'react';
import { useReferral } from '@/hooks/useReferral';
import { referralService } from '@/services/referral.service';
import type { Leaderboard } from '@/types/referral.types';

// This week's leaderboard. Reloads when the account's own points change (a friend just
// joined, a task was done) and whenever `refreshKey` changes (pull-to-refresh).
export function useLeaderboard(refreshKey = 0) {
  const { code, points } = useReferral();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setBoard(await referralService.leaderboard());
    } catch (err) {
      console.error('[useLeaderboard] failed to load', err);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (code) load();
  }, [code, points, refreshKey, load]);

  return { board, failed, reload: load };
}
