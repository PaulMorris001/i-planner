import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/config/firebase';
import { settingsService } from '@/services/settings.service';
import { planService } from '@/services/plan.service';
import { taskService } from '@/services/task.service';
import { billService } from '@/services/bill.service';
import { savingsGoalService } from '@/services/savingsGoal.service';
import { syncClassToAppleCalendar, syncTaskToAppleCalendar } from '@/utils/appleCalendarSync';
import { requestNotificationPermission } from '@/utils/notifications';
import { registerPushToken } from '@/utils/pushNotifications';
import {
  reconcileTaskNotifications,
  reconcileClassNotifications,
  reconcileBillNotifications,
  reconcileSavingsGoalNotifications,
  cancelAllDeviceReminders,
} from '@/utils/notificationReconcile';
import type { Settings } from '@/types/settings.types';
import type { StudentPlan, ClassItem } from '@/types/plan.types';

// Applies per-class patches (appleEventIds/notificationIds) from the backfill
// functions below. Re-fetches the plan right before saving rather than reusing
// the caller's snapshot — the backfill loop can take several seconds, and
// planService.save replaces the whole document, so a stale snapshot would
// clobber classes edited elsewhere meanwhile. Narrows the race window to one
// request round trip; doesn't fully close it.
async function saveClassPatches(patches: Map<string, Partial<ClassItem>>) {
  if (!patches.size) return;
  const freshPlan = await planService.get<StudentPlan>('student');
  if (!freshPlan) return;
  const classes = freshPlan.classes.map((c) => (patches.has(c.id) ? { ...c, ...patches.get(c.id) } : c));
  await planService.save('student', { ...freshPlan, classes });
}

// Backfills classes/tasks created before Apple Calendar was connected. Fetched
// directly via services, not usePlan()/useTasks(), since SettingsProvider is
// mounted above TasksProvider. Best-effort, never blocks the "connect" button.
async function backfillAppleCalendar() {
  try {
    const [plan, tasks] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
    ]);

    if (plan?.classes?.length) {
      const patches = new Map<string, Partial<ClassItem>>();
      await Promise.all(
        plan.classes.map(async (item) => {
          if (item.appleEventIds?.length) return;
          const appleEventIds = await syncClassToAppleCalendar(item);
          if (appleEventIds.length) patches.set(item.id, { appleEventIds });
        })
      );
      await saveClassPatches(patches);
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

// Same fetch-directly-via-services reasoning as backfillAppleCalendar above —
// SettingsProvider is mounted above TasksProvider, so useTasks()/useBills() aren't in scope.
//
// Goes through the same reconcile functions the providers use on every fetch,
// not its own scheduling loop: they hold a per-kind lock and a per-device
// schedule cache, so this running at the same moment as a provider's own
// reconcile (both happen at launch) can never schedule a duplicate set — the
// second pass just finds what the first one scheduled. It also covers every
// case the old empty-notificationIds check did (never scheduled, scheduling
// failed) plus reminders that vanished from the OS.
async function backfillReminders() {
  try {
    const [plan, tasks, bills, savingsGoals] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
      billService.list(),
      savingsGoalService.list(),
    ]);

    // Mirror this device's ids onto the server copy only where it has none —
    // it's just a fallback record (see persistSnoozeIds); each device keeps its
    // own authoritative ids in the reconcile cache.
    const newlyScheduled = <T extends { id: string; notificationIds?: string[] }>(before: T[], after: T[]) => {
      const byId = new Map(before.map((item) => [item.id, item]));
      return after.filter((item) => item.notificationIds?.length && !byId.get(item.id)?.notificationIds?.length);
    };

    if (plan?.classes?.length) {
      const reconciled = await reconcileClassNotifications(plan.classes, true);
      await saveClassPatches(
        new Map(newlyScheduled(plan.classes, reconciled).map((c) => [c.id, { notificationIds: c.notificationIds }]))
      );
    }
    const [reconciledTasks, reconciledBills, reconciledGoals] = await Promise.all([
      reconcileTaskNotifications(tasks, true),
      reconcileBillNotifications(bills, true),
      reconcileSavingsGoalNotifications(savingsGoals, true),
    ]);
    for (const t of newlyScheduled(tasks, reconciledTasks)) await taskService.update(t.id, { notificationIds: t.notificationIds });
    for (const b of newlyScheduled(bills, reconciledBills)) await billService.update(b.id, { notificationIds: b.notificationIds });
    for (const g of newlyScheduled(savingsGoals, reconciledGoals)) {
      await savingsGoalService.update(g.id, { notificationIds: g.notificationIds });
    }
  } catch (err) {
    console.error('[SettingsProvider] reminder backfill failed', err);
  }
}

// Cancels everything scheduled on this device — not just the ids the server
// copy happens to list, which can miss ones only this device knows about
// (reconcile-scheduled ids aren't always written back, snooze bursts never
// are) and leave them firing after reminders were switched off.
async function cancelAllReminders() {
  try {
    await cancelAllDeviceReminders();
    const [plan, tasks, bills, savingsGoals] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
      billService.list(),
      savingsGoalService.list(),
    ]);
    if (plan?.classes?.length) {
      await saveClassPatches(
        new Map(plan.classes.filter((c) => c.notificationIds?.length).map((c) => [c.id, { notificationIds: [] }]))
      );
    }
    for (const t of tasks) if (t.notificationIds?.length) await taskService.update(t.id, { notificationIds: [] });
    for (const b of bills) if (b.notificationIds?.length) await billService.update(b.id, { notificationIds: [] });
    for (const g of savingsGoals) if (g.notificationIds?.length) await savingsGoalService.update(g.id, { notificationIds: [] });
  } catch (err) {
    console.error('[SettingsProvider] failed to cancel reminders', err);
  }
}

const DEFAULT_SETTINGS: Settings = {
  appleCalendarConnected: false,
  googleCalendarConnected: false,
  outlookCalendarConnected: false,
  calendarGateDismissed: false,
  remindersEnabled: false,
  aiAccessTasks: true,
  aiAccessGoals: true,
  aiAccessCalendar: true,
  aiDisclosureAcknowledged: false,
  savingsDisclosureAcknowledged: false,
};

type AiAccessKey = 'aiAccessTasks' | 'aiAccessGoals' | 'aiAccessCalendar';

interface SettingsContextValue extends Settings {
  loading: boolean;
  connectAppleCalendar: () => Promise<boolean>;
  connectGoogleCalendar: () => Promise<boolean>;
  connectOutlookCalendar: () => Promise<boolean>;
  disconnectAppleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  disconnectOutlookCalendar: () => Promise<void>;
  dismissCalendarGate: () => Promise<void>;
  enableReminders: () => Promise<boolean>;
  disableReminders: () => Promise<void>;
  setAiAccess: (key: AiAccessKey, value: boolean) => Promise<void>;
  acknowledgeAiDisclosure: () => Promise<boolean>;
  acknowledgeSavingsDisclosure: () => Promise<boolean>;
  enableProductUpdates: () => Promise<boolean>;
  disableProductUpdates: () => Promise<void>;
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
      let fetched: Settings | null = null;
      try {
        fetched = await settingsService.get();
        setSettings(fetched);
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
      // Self-heals two related desyncs, both checked on every login/launch
      // (not just once) so they correct themselves the next time the app
      // opens rather than needing a manual toggle at all:
      //  1. The OS notification permission is actually granted, but
      //     remindersEnabled never got saved server-side — e.g. a transient
      //     network failure moments after the user granted permission during
      //     onboarding (enableReminders below rolls the flag back to false on
      //     any save failure, and notifications-prompt.tsx proceeds with
      //     onboarding regardless of whether it succeeded).
      //  2. remindersEnabled is already true, but some task/class/bill/goal
      //     still ended up with an empty notificationIds — e.g. it was
      //     created or edited while permission was momentarily off, or
      //     scheduling failed transiently (utils/notifications.ts's
      //     scheduleOccurrence fails silent-and-empty on purpose, by design,
      //     so nothing else catches this). A confirmed real complaint: a
      //     user's task alarm simply never fired, with the app showing
      //     nothing wrong. Only case 1 used to run backfillReminders() — case
      //     2 needs it just as much, and backfillReminders() is safe to call
      //     unconditionally here regardless of which case (or neither)
      //     applies: every item it touches is skipped unless its own
      //     notificationIds is already empty, so it can never double-schedule
      //     something that's already correctly set up.
      if (fetched) {
        try {
          const { granted } = await Notifications.getPermissionsAsync();
          if (granted) {
            if (!fetched.remindersEnabled) {
              setSettings(await settingsService.patch({ remindersEnabled: true }));
            }
            backfillReminders();
            // Keep this install's push token on the account (new install,
            // token rotation, or signing into a different account).
            registerPushToken();
          }
        } catch (err) {
          console.error('[SettingsProvider] failed to reconcile reminders permission', err);
        }
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

  // Identical backend-relay dance to Google above (open the authorize URL, wait for the iplanner://
  // deep link back, then re-fetch settings rather than guessing the outcome).
  const connectOutlookCalendar = async (): Promise<boolean> => {
    try {
      const { url } = await settingsService.startMicrosoftConnect();
      const result = await WebBrowser.openAuthSessionAsync(url, 'iplanner://oauth2redirect');
      if (result.type !== 'success' || !result.url.includes('status=success')) return false;
      setSettings(await settingsService.get());
      return true;
    } catch (err) {
      console.error('[SettingsProvider] failed to connect Outlook Calendar', err);
      return false;
    }
  };

  const disconnectOutlookCalendar = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, outlookCalendarConnected: false }));
    try {
      setSettings(await settingsService.disconnectOutlook());
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to disconnect Outlook Calendar', err);
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

  const enableReminders = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    const prevSettings = settings;
    setSettings((s) => ({ ...s, remindersEnabled: true }));
    try {
      setSettings(await settingsService.patch({ remindersEnabled: true }));
      backfillReminders();
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to enable reminders', err);
      return false;
    }
  };

  // We can't revoke the OS notification permission itself — only cancel what
  // we've already scheduled and stop scheduling new ones.
  const disableReminders = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, remindersEnabled: false }));
    try {
      setSettings(await settingsService.patch({ remindersEnabled: false }));
      cancelAllReminders();
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to disable reminders', err);
    }
  };

  const setAiAccess = async (key: AiAccessKey, value: boolean) => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, [key]: value }));
    try {
      setSettings(await settingsService.patch({ [key]: value }));
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to update AI data access', err);
    }
  };

  const acknowledgeAiDisclosure = async (): Promise<boolean> => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, aiDisclosureAcknowledged: true }));
    try {
      setSettings(await settingsService.patch({ aiDisclosureAcknowledged: true }));
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to acknowledge AI disclosure', err);
      return false;
    }
  };

  // Push announcements need the OS notification permission (shared with
  // reminders) plus a registered token; the backend only sends to accounts
  // with productUpdatesEnabled, so turning it off stops them right away.
  const enableProductUpdates = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
    const prevSettings = settings;
    setSettings((s) => ({ ...s, productUpdatesEnabled: true }));
    try {
      await registerPushToken();
      setSettings(await settingsService.patch({ productUpdatesEnabled: true }));
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to enable product updates', err);
      return false;
    }
  };

  const disableProductUpdates = async () => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, productUpdatesEnabled: false }));
    try {
      setSettings(await settingsService.patch({ productUpdatesEnabled: false }));
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to disable product updates', err);
    }
  };

  const acknowledgeSavingsDisclosure = async (): Promise<boolean> => {
    const prevSettings = settings;
    setSettings((s) => ({ ...s, savingsDisclosureAcknowledged: true }));
    try {
      setSettings(await settingsService.patch({ savingsDisclosureAcknowledged: true }));
      return true;
    } catch (err) {
      setSettings(prevSettings);
      console.error('[SettingsProvider] failed to acknowledge savings disclosure', err);
      return false;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        loading,
        connectAppleCalendar,
        connectGoogleCalendar,
        connectOutlookCalendar,
        disconnectAppleCalendar,
        disconnectGoogleCalendar,
        disconnectOutlookCalendar,
        dismissCalendarGate,
        enableReminders,
        disableReminders,
        setAiAccess,
        acknowledgeAiDisclosure,
        acknowledgeSavingsDisclosure,
        enableProductUpdates,
        disableProductUpdates,
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
