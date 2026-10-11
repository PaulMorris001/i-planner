import { Response } from 'express';
import { AuthedRequest } from '../middleware/requireAuth';
import { wipeUserData } from '../services/accountData';
import { invalidateLeaderboardCache } from '../services/referralLeaderboard';

// Wipes every piece of app data owned by this user. Firebase Auth account deletion
// happens client-side afterward — must run first, while the caller's token is still valid.
export async function deleteAccount(req: AuthedRequest, res: Response) {
  const firebaseUid = req.userId!;

  await wipeUserData(firebaseUid);
  // The weekly leaderboard is cached for a minute: don't keep showing a deleted account.
  invalidateLeaderboardCache();

  res.status(204).send();
}
