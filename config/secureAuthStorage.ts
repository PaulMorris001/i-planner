import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

// Firebase's persisted auth session (ID token, refresh token, user metadata as
// one JSON blob) is a few KB — comfortably over SecureStore's hard 2048-byte
// per-value limit, and its storage keys contain ":" characters SecureStore's
// key charset (alphanumeric/./-/_ only) doesn't allow. So the session itself
// can't go into SecureStore directly. Instead: a single small AES key lives in
// SecureStore (Keychain/Keystore-backed — needs actual device compromise, not
// just filesystem/backup access, to read), and it's used to encrypt/decrypt
// whatever Firebase writes to/reads from AsyncStorage. Plaintext auth data is
// never on disk; extracting it requires both the encrypted blob AND the key.
const ENCRYPTION_KEY_STORAGE_KEY = 'iplanner_firebase_auth_key';

// Cached at module scope so concurrent setItem/getItem calls during sign-in
// (Firebase can fire several in quick succession) all await the same
// in-flight key lookup/creation instead of racing to create two different
// keys, where the second write would silently strand data encrypted with the
// first.
let keyPromise: Promise<string> | null = null;

function getOrCreateEncryptionKey(): Promise<string> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
      if (existing) return existing;
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const key = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
      return key;
    })();
  }
  return keyPromise;
}

// Same shape Firebase's getReactNativePersistence expects (and that
// AsyncStorage itself provides) — a drop-in replacement in config/firebase.ts.
export const secureAuthStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await getOrCreateEncryptionKey();
    const ciphertext = CryptoJS.AES.encrypt(value, encryptionKey).toString();
    await AsyncStorage.setItem(key, ciphertext);
  },

  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    try {
      const encryptionKey = await getOrCreateEncryptionKey();
      const plaintext = CryptoJS.AES.decrypt(stored, encryptionKey).toString(CryptoJS.enc.Utf8);
      // Empty string means decryption "succeeded" on data that wasn't ours —
      // e.g. a plaintext session written before this encryption was added.
      // Treating it as "nothing stored" is correct: Firebase just re-prompts
      // sign-in once rather than crashing on unparseable session data.
      return plaintext || null;
    } catch {
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
