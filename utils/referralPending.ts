import AsyncStorage from '@react-native-async-storage/async-storage';

// The referral code someone typed at sign-up, kept on the device until the
// server has accepted it. Sign-up can succeed while the follow-up request fails
// (no signal for a moment), so the code is retried on the next launch rather
// than lost. ReferralContext sends it and clears it.
const KEY = 'referral:pending-code';

export async function savePendingReferralCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch (err) {
    console.error('[referral] could not remember the referral code', err);
  }
}

export async function getPendingReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; the server ignores a repeat redemption anyway.
  }
}
