import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore -- not in the public TS types yet, but present in the RN build.
  getReactNativePersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { secureAuthStorage } from './secureAuthStorage';
import { logAuthDebug } from '@/utils/authDebugLog';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

logAuthDebug(`firebase config projectId=${firebaseConfig.projectId ?? 'MISSING'}`);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth =
  Platform.OS === 'web'
    ? (() => {
        try {
          return initializeAuth(app, { persistence: browserLocalPersistence });
        } catch {
          return getAuth(app);
        }
      })()
    : (() => {
        try {
          logAuthDebug(`getReactNativePersistence is ${typeof getReactNativePersistence}`);
          const persistence = getReactNativePersistence(secureAuthStorage);
          const result = initializeAuth(app, { persistence });
          logAuthDebug('initializeAuth succeeded with getReactNativePersistence(secureAuthStorage)');
          return result;
        } catch (err) {
          // If this fires, every session is memory-only for the rest of this
          // process — no persisted-session read/write ever happens, which
          // would exactly explain "have to log in every time I reopen the
          // app." Logged here specifically to catch that.
          logAuthDebug(`initializeAuth(getReactNativePersistence) THREW, falling back to getAuth(): ${String(err)}`);
          return getAuth(app);
        }
      })();
