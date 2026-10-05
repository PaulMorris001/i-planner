import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { referralService } from '@/services/referral.service';
import { clearPendingReferralCode, getPendingReferralCode } from '@/utils/referralPending';
import type { ReferralProfile } from '@/types/referral.types';

interface ReferralContextValue {
  // False until the first load for the signed-in account has finished.
  loaded: boolean;
  code: string;
  handle: string;
  points: number;
  referralCount: number;
  referredBy: boolean;
  welcomePending: boolean;
  rewards: ReferralProfile['rewards'];
  // The "your referral code" popup, opened by tapping the points badge. (A new
  // sign-up's welcome popup opens by itself; see ReferralModal.)
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  refresh: () => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
}

const EMPTY_REWARDS = { referrer: 0, referred: 0 };
const ReferralContext = createContext<ReferralContextValue | null>(null);

// A failed request is worth retrying later (no signal, server hiccup, token not
// ready); a rejected one (bad code, too late) never will succeed.
function isTemporaryFailure(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === undefined || status === 0 || status === 401 || status >= 500;
}

export function ReferralProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Keeps overlapping loads (sign-in + foreground) from running over each other.
  const loadingRef = useRef(false);

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      // A code typed at sign-up goes first, so the points are already in the
      // profile fetched next.
      const pending = await getPendingReferralCode();
      if (pending) {
        try {
          await referralService.signUp(pending);
          await clearPendingReferralCode();
        } catch (err) {
          console.error('[ReferralProvider] could not apply the referral code', err);
          if (!isTemporaryFailure(err)) await clearPendingReferralCode();
        }
      }
      setProfile(await referralService.me());
    } catch (err) {
      console.error('[ReferralProvider] failed to load referral info', err);
    } finally {
      setLoaded(true);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProfile(null);
        setLoaded(false);
        setModalOpen(false);
        return;
      }
      load();
    });
    return unsubscribe;
  }, []);

  const markWelcomeSeen = async () => {
    // Optimistic: the popup closes right away, and a failed request just shows it once more.
    setProfile((p) => (p ? { ...p, welcomePending: false } : p));
    try {
      setProfile(await referralService.markWelcomeSeen());
    } catch (err) {
      console.error('[ReferralProvider] failed to record that the welcome was seen', err);
    }
  };

  return (
    <ReferralContext.Provider
      value={{
        loaded,
        code: profile?.code ?? '',
        handle: profile?.handle ?? '',
        points: profile?.points ?? 0,
        referralCount: profile?.referralCount ?? 0,
        referredBy: profile?.referredBy ?? false,
        welcomePending: profile?.welcomePending ?? false,
        rewards: profile?.rewards ?? EMPTY_REWARDS,
        modalOpen,
        openModal: () => setModalOpen(true),
        closeModal: () => setModalOpen(false),
        refresh: load,
        markWelcomeSeen,
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const ctx = useContext(ReferralContext);
  if (!ctx) throw new Error('useReferral must be used within a ReferralProvider');
  return ctx;
}
