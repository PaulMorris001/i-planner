import { Share } from 'react-native';
import { referralShareMessage } from '@/utils/referralLink';

// Opens the phone's share sheet with the account's referral link (and plain code). Shared by the
// Profile/Leaderboard card, the code popup and the "already a member" popup.
export function useShareReferralLink(code: string) {
  const share = async () => {
    if (!code) return;
    try {
      await Share.share({ message: referralShareMessage(code) });
    } catch (err) {
      console.error('[referral] could not open the share sheet', err);
    }
  };

  return { share };
}
