import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettings } from '@/hooks/useSettings';
import { registerPushToken } from '@/utils/pushNotifications';

export type NotificationPermission = 'unknown' | 'granted' | 'undetermined' | 'denied';

async function readPermission(): Promise<NotificationPermission> {
  try {
    const { granted, status } = await Notifications.getPermissionsAsync();
    if (granted) return 'granted';
    return status === Notifications.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
  } catch {
    return 'unknown';
  }
}

// This device's notification permission, kept fresh when the app comes back to the front (so it
// updates right after someone switches it on in the phone's Settings) — and, once it is granted,
// makes sure this install's push token is saved on the account.
export function useNotificationPermission() {
  const { enableReminders } = useSettings();
  const [permission, setPermission] = useState<NotificationPermission>('unknown');

  const refresh = useCallback(async () => {
    const current = await readPermission();
    setPermission(current);
    if (current === 'granted') registerPushToken();
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Never asked yet: show the system prompt. Already refused: the system won't ask twice, so the
  // only way back is the phone's Settings, which is opened directly.
  const turnOn = useCallback(async () => {
    if (permission === 'denied') {
      await Linking.openSettings().catch((err) => console.error('[notifications] could not open settings', err));
      return;
    }
    await enableReminders();
    await refresh();
  }, [permission, enableReminders, refresh]);

  return { permission, turnOn };
}
