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
import {
  requestNotificationPermission,
  scheduleTaskNotifications,
  scheduleClassNotifications,
  scheduleBillNotifications,
  scheduleSavingsGoalNotifications,
  cancelNotifications,
} from '@/utils/notifications';
import {
  markTaskScheduled,
  markClassScheduled,
  markBillScheduled,
  markSavingsGoalScheduled,
  clearTaskSchedule,
  clearClassSchedule,
  clearBillSchedule,
  clearSavingsGoalSchedule,
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
// Each mark*Scheduled call below keeps utils/notificationReconcile.ts's
// per-device cache in sync with what this function just scheduled — without
// it, the next reconcile pass (the very next foreground/pull-to-refresh)
// would find a stale cache entry from *before* reminders were disabled,
// see the item's other fields unchanged, and report those old (already-
// cancelled) ids back into app state instead of the fresh ones just
// scheduled here — leaving the real notification untracked and never
// cancelled on a later edit/delete.
async function backfillReminders() {
  try {
    const [plan, tasks, bills, savingsGoals] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
      billService.list(),
      savingsGoalService.list(),
    ]);

    if (plan?.classes?.length) {
      const patches = new Map<string, Partial<ClassItem>>();
      await Promise.all(
        plan.classes.map(async (item) => {
          if (item.notificationIds?.length || !item.time) return;
          const notificationIds = await scheduleClassNotifications(item);
          if (notificationIds.length) {
            patches.set(item.id, { notificationIds });
            await markClassScheduled({ ...item, notificationIds }, notificationIds);
          }
        })
      );
      await saveClassPatches(patches);
    }

    for (const task of tasks) {
      if (task.notificationIds?.length || task.done || !task.dueDate || !task.time) continue;
      const notificationIds = await scheduleTaskNotifications(task);
      if (notificationIds.length) {
        await taskService.update(task.id, { notificationIds });
        await markTaskScheduled({ ...task, notificationIds }, notificationIds);
      }
    }

    for (const bill of bills) {
      if (bill.notificationIds?.length) continue;
      const notificationIds = await scheduleBillNotifications(bill);
      if (notificationIds.length) {
        await billService.update(bill.id, { notificationIds });
        await markBillScheduled({ ...bill, notificationIds }, notificationIds);
      }
    }

    for (const goal of savingsGoals) {
      if (goal.notificationIds?.length) continue;
      const notificationIds = await scheduleSavingsGoalNotifications(goal);
      if (notificationIds.length) {
        await savingsGoalService.update(goal.id, { notificationIds });
        await markSavingsGoalScheduled({ ...goal, notificationIds }, notificationIds);
      }
    }
  } catch (err) {
    console.error('[SettingsProvider] reminder backfill failed', err);
  }
}

async function cancelAllReminders() {
  try {
    const [plan, tasks, bills, savingsGoals] = await Promise.all([
      planService.get<StudentPlan>('student'),
      taskService.list(),
      billService.list(),
      savingsGoalService.list(),
    ]);

    if (plan?.classes?.length) {
      const patches = new Map<string, Partial<ClassItem>>();
      await Promise.all(
        plan.classes.map(async (item) => {
          if (!item.notificationIds?.length) return;
          await cancelNotifications(item.notificationIds);
          patches.set(item.id, { notificationIds: [] });
          await clearClassSchedule(item.id);
        })
      );
      await saveClassPatches(patches);
    }

    for (const task of tasks) {
      if (!task.notificationIds?.length) continue;
      await cancelNotifications(task.notificationIds);
      await taskService.update(task.id, { notificationIds: [] });
      await clearTaskSchedule(task.id);
    }

    for (const bill of bills) {
      if (!bill.notificationIds?.length) continue;
      await cancelNotifications(bill.notificationIds);
      await billService.update(bill.id, { notificationIds: [] });
      await clearBillSchedule(bill.id);
    }

    for (const goal of savingsGoals) {
      if (!goal.notificationIds?.length) continue;
      await cancelNotifications(goal.notificationIds);
      await savingsGoalService.update(goal.id, { notificationIds: [] });
      await clearSavingsGoalSchedule(goal.id);
    }
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
      // Self-heals a specific desync: the OS notification permission is
      // actually granted, but remindersEnabled never got saved server-side —
      // e.g. a transient network failure moments after the user granted
      // permission during onboarding (enableReminders below rolls the flag
      // back to false on any save failure, and notifications-prompt.tsx
      // proceeds with onboarding regardless of whether it succeeded). Left
      // uncorrected, every task/class/bill/goal created afterward silently
      // gets zero reminders scheduled — with nothing telling the user why —
      // until they happen to discover and manually toggle Reminders off and
      // back on in Profile & Settings. Checked on every login/launch, not
      // just once, so it corrects itself the next time the app opens rather
      // than needing that manual toggle at all.
      if (fetched && !fetched.remindersEnabled) {
        try {
          const { granted } = await Notifications.getPermissionsAsync();
          if (granted) {
            setSettings(await settingsService.patch({ remindersEnabled: true }));
            backfillReminders();
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

  // Read-only import, unlike Google above — otherwise the identical
  // backend-relay dance (open the authorize URL, wait for the iplanner://
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
