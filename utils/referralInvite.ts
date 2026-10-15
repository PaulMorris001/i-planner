import AsyncStorage from '@react-native-async-storage/async-storage';

// The code from a referral link someone opened before they had an account, kept until the sign-up
// screen uses it. Separate from the "pending" code in referralPending.ts, which is a code already
// submitted at sign-up and being retried: this one is only ever read to fill in the sign-up form,
// so an existing account that signs in instead can never redeem it by accident.
const KEY = 'referral:invite-code';

export async function saveInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch (err) {
    console.error('[referral] could not remember the invitation code', err);
  }
}

export async function getInviteCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; it only pre-fills a form.
  }
}
