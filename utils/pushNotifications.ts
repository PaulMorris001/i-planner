import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { pushService } from '@/services/push.service';

// Remote (server-sent) push, as opposed to the local reminders in
// utils/notifications.ts. The backend only stores Expo push tokens; Expo relays
// to FCM/APNs with the credentials kept in EAS.

// This install's Expo push token, or null when it can't have one: no
// notification permission, a simulator/emulator, or a build without push
// credentials. Never prompts for permission itself.
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[push] no push token available', err);
    return null;
  }
}

// Best-effort: saves this install's token on the signed-in account. Safe to
// call on every launch/sign-in; the backend upserts.
export async function registerPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  await pushService
    .register(token, Platform.OS === 'ios' ? 'ios' : 'android')
    .catch((err) => console.error('[push] failed to register token', err));
}

// On sign-out, before the session ends: stops this phone getting the old
// account's pushes. Capped so a slow network never holds up signing out.
export async function unregisterPushToken(): Promise<void> {
  const work = (async () => {
    const token = await getExpoPushToken();
    if (token) await pushService.unregister(token);
  })().catch((err) => console.error('[push] failed to unregister token', err));
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, 3000))]);
}
