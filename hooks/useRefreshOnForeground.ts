import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { auth } from '@/config/firebase';

// Don't refetch more often than this when the app is switched back to in quick succession.
const MIN_INTERVAL_MS = 20_000;

// Runs `refresh` each time the app comes back to the foreground while someone is signed in.
//
// Reminders are scheduled on the phone itself, from the data it last fetched. Without this, a task
// created on another device is only noticed the next time the app is cold-started or
// pull-to-refreshed, so this phone has no reminder for it. Coming back to the app is the
// earliest moment it can pick the change up without a push.
//
// `skip` lets a screen opt out while its own write is in flight, so a refetch can't overwrite an
// optimistic row that hasn't reached the server yet.
export function useRefreshOnForeground(refresh: () => unknown, skip?: () => boolean) {
  // Always the latest closure, so the listener below never uses a stale `refresh` (the settings
  // it closes over load a moment after the first render).
  const latest = useRef({ refresh, skip });
  latest.current = { refresh, skip };
  const lastRunRef = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !auth.currentUser) return;
      const now = Date.now();
      if (now - lastRunRef.current < MIN_INTERVAL_MS) return;
      if (latest.current.skip?.()) return;
      lastRunRef.current = now;
      Promise.resolve(latest.current.refresh()).catch((err) => {
        console.error('[useRefreshOnForeground] refresh failed', err);
      });
    });
    return () => subscription.remove();
  }, []);
}
