import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

// Identifies this app install to the backend, so the "new sign-in" email only
// goes out for a device the account hasn't used before (see
// backend/src/controllers/authEmail.controller.ts). A random id generated on
// first use — not a hardware identifier. Reinstalling the app makes a new one,
// which reads as a new device; that's acceptable for a security notice.
const STORAGE_KEY = 'device-id:v1';

let cached: Promise<string> | null = null;

function getDeviceId(): Promise<string> {
  cached ??= (async () => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
    } catch {
      // Fall through and generate one; worst case this install looks new once.
    }
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
    return id;
  })();
  return cached;
}

// e.g. "Chris's iPhone · iOS 18.2" — shown in the new-device email.
function getDeviceLabel(): string {
  const os = Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`;
  const name = Constants.deviceName?.trim() || (Platform.OS === 'ios' ? 'iPhone' : 'Android device');
  return `${name} · ${os}`;
}

export async function getDeviceInfo(): Promise<{ deviceId: string; deviceLabel: string }> {
  return { deviceId: await getDeviceId(), deviceLabel: getDeviceLabel() };
}
