import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const ONBOARDING_KEY = '@iplanner_onboarded';
const FOCUS_KEY = '@iplanner_focus_profile';

interface OnboardingContextValue {
  hasOnboarded: boolean | null;
  focusProfile: string | null;
  completeOnboarding: () => Promise<void>;
  setFocusProfile: (profile: string) => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [focusProfile, setFocusProfileState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(FOCUS_KEY),
    ]).then(([onboarded, focus]) => {
      setHasOnboarded(onboarded === 'true');
      setFocusProfileState(focus);
    }).catch((err) => {
      // Without this, a rejected read (storage corruption, low-level I/O
      // error — rare but not impossible) is a genuinely unhandled promise
      // rejection, and hasOnboarded stays null forever — whatever gate reads
      // it (app/index.tsx) would be stuck on a loading state indefinitely.
      // Falls back to "not onboarded" rather than guessing true, matching
      // resetOnboarding's own default — safe to redo onboarding, unsafe to
      // wrongly skip it.
      console.error('[OnboardingProvider] failed to read onboarding state', err);
      setHasOnboarded(false);
      setFocusProfileState(null);
    });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setHasOnboarded(true);
  };

  const setFocusProfile = async (profile: string) => {
    await AsyncStorage.setItem(FOCUS_KEY, profile);
    setFocusProfileState(profile);
  };

  const resetOnboarding = async () => {
    await AsyncStorage.multiRemove([ONBOARDING_KEY, FOCUS_KEY]);
    setHasOnboarded(false);
    setFocusProfileState(null);
  };

  return (
    <OnboardingContext.Provider
      value={{ hasOnboarded, focusProfile, completeOnboarding, setFocusProfile, resetOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
