import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { logAuthDebug } from '@/utils/authDebugLog';

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
      logAuthDebug('secureAuthStorage: checking SecureStore for existing key');
      let existing: string | null = null;
      try {
        existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
      } catch (err) {
        logAuthDebug(`secureAuthStorage: SecureStore.getItemAsync THREW: ${String(err)}`);
        throw err;
      }
      if (existing) {
        logAuthDebug('secureAuthStorage: found existing key in SecureStore');
        return existing;
      }
      logAuthDebug('secureAuthStorage: no existing key — generating a new one');
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const key = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      try {
        await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
        logAuthDebug('secureAuthStorage: new key saved to SecureStore');
      } catch (err) {
        logAuthDebug(`secureAuthStorage: SecureStore.setItemAsync THREW: ${String(err)}`);
        throw err;
      }
      return key;
    })();
  }
  return keyPromise;
}

// Fire this off immediately at module load instead of waiting for the first
// setItem/getItem call. Firebase's initializeAuth() probes this persistence's
// _isAvailable() (a setItem+removeItem round trip) exactly once during
// startup — and per firebase/auth's source (PersistenceUserManager.create,
// node_modules/@firebase/auth/dist/rn/index-7d302f10.js), if that probe
// throws OR returns false for ANY reason, Firebase silently falls back to
// its in-memory-only persistence for the rest of the process. No error, no
// log, initializeAuth() still resolves normally — it would look exactly like
// "login works, but the session doesn't survive an app restart." Starting
// the SecureStore round trip here, before config/firebase.ts's
// initializeAuth() call even runs (module evaluation order guarantees this
// module finishes first, since firebase.ts imports it), means the key is
// already resolved or in flight by the time that one-shot probe happens,
// instead of racing a cold SecureStore lookup against it. Errors are
// swallowed here (not left as an unhandled rejection) because
// getOrCreateEncryptionKey() is re-awaited by the real setItem/getItem calls
// below, which already log failures via logAuthDebug.
getOrCreateEncryptionKey().catch(() => {});

// Same shape Firebase's getReactNativePersistence expects (and that
// AsyncStorage itself provides) — a drop-in replacement in config/firebase.ts.
export const secureAuthStorage = {
  async setItem(key: string, value: string): Promise<void> {
    logAuthDebug(`secureAuthStorage.setItem("${key}") — value length ${value.length}`);
    const encryptionKey = await getOrCreateEncryptionKey();
    const ciphertext = CryptoJS.AES.encrypt(value, encryptionKey).toString();
    await AsyncStorage.setItem(key, ciphertext);
    logAuthDebug(`secureAuthStorage.setItem("${key}") — wrote ${ciphertext.length} encrypted chars to AsyncStorage`);
  },

  async getItem(key: string): Promise<string | null> {
    logAuthDebug(`secureAuthStorage.getItem("${key}") — reading AsyncStorage`);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      logAuthDebug(`secureAuthStorage.getItem("${key}") — nothing in AsyncStorage for this key`);
      return null;
    }
    logAuthDebug(`secureAuthStorage.getItem("${key}") — found ${stored.length} encrypted chars, decrypting`);
    try {
      const encryptionKey = await getOrCreateEncryptionKey();
      const plaintext = CryptoJS.AES.decrypt(stored, encryptionKey).toString(CryptoJS.enc.Utf8);
      // Empty string means decryption "succeeded" on data that wasn't ours —
      // e.g. a plaintext session written before this encryption was added.
      // Treating it as "nothing stored" is correct: Firebase just re-prompts
      // sign-in once rather than crashing on unparseable session data.
      if (!plaintext) {
        logAuthDebug(`secureAuthStorage.getItem("${key}") — decrypted to EMPTY string (wrong key, or pre-encryption data)`);
        return null;
      }
      logAuthDebug(`secureAuthStorage.getItem("${key}") — decrypt succeeded, ${plaintext.length} chars`);
      return plaintext;
    } catch (err) {
      logAuthDebug(`secureAuthStorage.getItem("${key}") — decrypt THREW: ${String(err)}`);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    logAuthDebug(`secureAuthStorage.removeItem("${key}")`);
    await AsyncStorage.removeItem(key);
  },
};
