import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlreadyMemberModal } from '@/components/referral/AlreadyMemberModal';
import { Colors } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useReferral } from '@/hooks/useReferral';
import { useShareReferralLink } from '@/hooks/useShareReferralLink';
import { isWellFormedReferralCode, normalizeReferralCode } from '@/utils/referralLink';
import { saveInviteCode } from '@/utils/referralInvite';

// How long to wait for the account's referral details before showing the popup anyway.
const LOAD_WAIT_MS = 2500;

// Where a friend's referral link lands: https://api.i-plannerapp.com/r/<code> (or iplanner://r/<code>).
//
//  - Not signed in: remember the code and go to sign-up with it already filled in.
//  - Signed in: a code only works for a brand-new account, so show a friendly note instead.
//
// A link that launches the app has no screen behind this one, so it always routes forward.
export default function ReferralLink() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string }>();
  const { user, initializing } = useAuth();
  const { code: ownCode, rewards, loaded } = useReferral();
  const { share } = useShareReferralLink(ownCode);
  const [modalOpen, setModalOpen] = useState(false);

  const code = normalizeReferralCode(rawCode);
  const usable = isWellFormedReferralCode(code);

  useEffect(() => {
    if (initializing) return;
    if (user) {
      // Wait (briefly) for the account's own code and reward amounts, so the popup never shows
      // "0 points" or a Share button with nothing to share.
      if (loaded) {
        setModalOpen(true);
        return;
      }
      const timer = setTimeout(() => setModalOpen(true), LOAD_WAIT_MS);
      return () => clearTimeout(timer);
    }
    // Not signed in: straight to sign-up with the code in place.
    (async () => {
      if (usable) await saveInviteCode(code);
      router.replace({ pathname: Routes.REGISTER, params: usable ? { ref: code } : {} });
    })();
  }, [initializing, user, loaded, usable, code]);

  const close = () => {
    setModalOpen(false);
    router.replace(Routes.DASHBOARD);
  };

  const handleShare = async () => {
    await share();
    close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.offWhite, alignItems: 'center', justifyContent: 'center' }}>
      {!modalOpen && <ActivityIndicator color={Colors.primaryLight} />}
      <AlreadyMemberModal
        visible={modalOpen}
        isOwnLink={!!ownCode && ownCode === code}
        rewards={rewards}
        canShare={!!ownCode}
        onShare={handleShare}
        onClose={close}
      />
    </View>
  );
}
