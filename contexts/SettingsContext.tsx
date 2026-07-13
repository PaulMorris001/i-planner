import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import * as Calendar from 'expo-calendar';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/config/firebase';
import { settingsService } from '@/services/settings.service';
import type { Settings } from '@/types/settings.types';

const DEFAULT_SETTINGS: Settings = {
  appleCalendarConnected: false,
  googleCalendarConnected: false,
  calendarGateDismissed: false,
};

interface SettingsContextValue extends Settings {
  loading: boolean;
  connectAppleCalendar: () => Promise<boolean>;
  connectGoogleCalendar: () => Promise<boolean>;
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
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to save calendar connection', err);
      return false;
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
