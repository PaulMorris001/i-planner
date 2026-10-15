import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { auth } from '@/config/firebase';
import { referralCodeFromInstallReferrer } from '@/utils/referralLink';
import { saveInviteCode } from '@/utils/referralInvite';

const CHECKED_KEY = 'referral:install-referrer-checked';

// Android only. A friend's shared link sends a new person to Google Play with the code attached;
// after installing, Play tells the app what the link said. Read once, on the first launch, and
// remembered so the sign-up screen can fill the code in. Nothing happens for anyone who already
// has an account on this phone, or on a launch that isn't the first.
export function useInstallReferral() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        if (await AsyncStorage.getItem(CHECKED_KEY)) return;
        await AsyncStorage.setItem(CHECKED_KEY, '1');
        // Wait for the saved session to load: someone already signed in has no use for a code.
        await auth.authStateReady();
        if (cancelled || auth.currentUser) return;
        const referrer = await Application.getInstallReferrerAsync();
        const code = referralCodeFromInstallReferrer(referrer);
        if (code) await saveInviteCode(code);
      } catch (err) {
        // The Play Store can be missing (some emulators and sideloaded installs): no code then.
        console.warn('[referral] could not read the install referrer', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
