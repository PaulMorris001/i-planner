import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import * as Calendar from 'expo-calendar';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/config/firebase';
import { settingsService } from '@/services/settings.service';
import { planService } from '@/services/plan.service';
import { taskService } from '@/services/task.service';
import { syncClassToAppleCalendar, syncTaskToAppleCalendar } from '@/utils/appleCalendarSync';
import type { Settings } from '@/types/settings.types';
import type { StudentPlan } from '@/types/plan.types';

// Classes/tasks created before the user connected Apple Calendar still need to end
// up on the device calendar — fetched directly via services (not usePlan()/
// useTasks()) since SettingsProvider is mounted above TasksProvider, which is
// scoped to the (app) tab group and wouldn't be in scope here. Runs in the
// background — best-effort, never blocks the "connect" button.
async function backfillAppleCalendar() {
  try {
    const [plan, tasks] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
    ]);

    if (plan?.classes?.length) {
      let changed = false;
      const classes = await Promise.all(
        plan.classes.map(async (item) => {
          if (item.appleEventIds?.length) return item;
          const appleEventIds = await syncClassToAppleCalendar(item);
          if (appleEventIds.length) changed = true;
          return { ...item, appleEventIds };
        })
      );
      if (changed) await planService.save('student', { ...plan, classes });
    }

    for (const task of tasks) {
      if (task.appleEventIds?.length || !task.dueDate) continue;
      const appleEventIds = await syncTaskToAppleCalendar(task);
      if (appleEventIds.length) await taskService.update(task.id, { appleEventIds });
    }
  } catch (err) {
    console.error('[SettingsProvider] Apple Calendar backfill failed', err);
  }
}

const DEFAULT_SETTINGS: Settings = {
  appleCalendarConnected: false,
  googleCalendarConnected: false,
  calendarGateDismissed: false,
};

interface SettingsContextValue extends Settings {
  loading: boolean;
  connectAppleCalendar: () => Promise<boolean>;
  connectGoogleCalendar: () => Promise<boolean>;
  disconnectAppleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  dismissCalendarGate: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }
      try {
        setSettings(await settingsService.get());
      } catch (err) {
        console.error('[SettingsProvider] failed to load settings', err);
      } finally {
        setLoading(false);
      }
      // Best-effort, fire-and-forget — lets Google Calendar sync place events at
      // the correct local hour instead of UTC. Not reflected in local state since
      // it's write-only from the client's perspective.
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone) settingsService.patch({ timeZone });
      } catch (err) {
        console.error('[SettingsProvider] failed to report timezone', err);
      }
    });
    return unsubscribe;
  }, []);

  const connectAppleCalendar = async (): Promise<boolean> => {
    const { granted } = await Calendar.requestCalendarPermissionsAsync();
    if (!granted) return false;

    const prevSettings = settings;
    setSettings((s) => ({ ...s, appleCalendarConnected: true }));
    try {
      setSettings(await settingsService.patch({ appleCalendarConnected: true }));
      backfillAppleCalendar();
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to save calendar connection', err);
      return false;
    }
  };

  // Turns off future syncing from our side — we can't programmatically revoke the
  // OS-level Calendar permission itself (only the user can, from device Settings),
  // and we deliberately don't delete events already written to their calendar.
  const disconnectAppleCalendar = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, appleCalendarConnected: false }));
    try {
      setSettings(await settingsService.patch({ appleCalendarConnected: false }));
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to disconnect Apple Calendar', err);
    }
  };

  const connectGoogleCalendar = async (): Promise<boolean> => {
    try {
      const { url } = await settingsService.startGoogleConnect();
      const result = await WebBrowser.openAuthSessionAsync(url, 'iplanner://oauth2redirect');
      // result.type === 'success' just means the OS routed the deep link back to us —
      // the backend still stamps its own outcome in the ?status= query param, since
      // it's the one that actually did the token exchange.
      if (result.type !== 'success' || !result.url.includes('status=success')) return false;
      // The backend already persisted the connection during the redirect — just
      // re-fetch rather than optimistically guessing the outcome client-side.
      setSettings(await settingsService.get());
      return true;
    } catch (err) {
      console.error('[SettingsProvider] failed to connect Google Calendar', err);
      return false;
    }
  };

  const disconnectGoogleCalendar = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, googleCalendarConnected: false }));
    try {
      setSettings(await settingsService.disconnectGoogle());
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to disconnect Google Calendar', err);
    }
  };

  const dismissCalendarGate = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, calendarGateDismissed: true }));
    try {
      setSettings(await settingsService.patch({ calendarGateDismissed: true }));
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to dismiss calendar gate', err);
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        loading,
        connectAppleCalendar,
        connectGoogleCalendar,
        disconnectAppleCalendar,
        disconnectGoogleCalendar,
        dismissCalendarGate,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
