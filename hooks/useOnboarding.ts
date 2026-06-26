import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ONBOARDING_KEY  = '@iplanner_onboarded';
const FOCUS_KEY       = '@iplanner_focus_profile';

export function useOnboarding() {
  const [hasOnboarded, setHasOnboarded]   = useState<boolean | null>(null);
  const [focusProfile, setFocusProfileState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(FOCUS_KEY),
    ]).then(([onboarded, focus]) => {
      setHasOnboarded(onboarded === 'true');
      setFocusProfileState(focus);
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

  return {
    hasOnboarded,
    focusProfile,
    completeOnboarding,
    setFocusProfile,
    resetOnboarding,
  };
}