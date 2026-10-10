import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

// Runs when the server sends a silent "sync" push (backend services/deviceSync.ts): another device
// changed something, so this one refreshes its data and schedules its own reminders for it, even
// while the app is in the background.
//
// Imported from index.js: a background task has to be defined at the top level of the entry file,
// before any screen exists. Everything heavy is imported lazily inside the task for that reason.
const BACKGROUND_SYNC_TASK = 'iplanner-background-sync';

// Two wake-ups close together (the server already merges bursts) need only one refresh.
const MIN_INTERVAL_MS = 15_000;
let lastRunAt = 0;

// The push's custom data arrives differently on iOS and Android, so look for `kind` in the places
// it can be. Returns undefined when it can't be found.
function kindOf(payload: unknown): string | undefined {
  const seen = new Set<unknown>();
  const search = (value: unknown, depth: number): string | undefined => {
    if (!value || depth > 4 || seen.has(value)) return undefined;
    if (typeof value === 'string') {
      try {
        return search(JSON.parse(value), depth + 1);
      } catch {
        return undefined;
      }
    }
    if (typeof value !== 'object') return undefined;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (typeof record.kind === 'string') return record.kind;
    for (const key of ['data', 'dataString', 'body', 'notification', 'request', 'content']) {
      const found = search(record[key], depth + 1);
      if (found) return found;
    }
    return undefined;
  };
  return search(payload, 0);
}

async function refreshRemindersFromServer(): Promise<void> {
  const { auth } = await import('@/config/firebase');
  // The saved session is loaded asynchronously when the app is started in the background.
  await auth.authStateReady();
  if (!auth.currentUser) return;

  const { settingsService } = await import('@/services/settings.service');
  const settings = await settingsService.get();
  const remindersEnabled = settings.remindersEnabled ?? false;
  // With reminders off there is nothing to schedule on this device.
  if (!remindersEnabled) return;

  const [{ taskService }, { billService }, { savingsGoalService }, { planService }, reconcile] = await Promise.all([
    import('@/services/task.service'),
    import('@/services/bill.service'),
    import('@/services/savingsGoal.service'),
    import('@/services/plan.service'),
    import('@/utils/notificationReconcile'),
  ]);
  const { reconcileTaskNotifications, reconcileBillNotifications, reconcileSavingsGoalNotifications, reconcileClassNotifications } = reconcile;

  // Each kind on its own: one failing must not stop the others.
  await Promise.allSettled([
    taskService.list().then((tasks) => reconcileTaskNotifications(tasks, remindersEnabled)),
    billService.list().then((bills) => reconcileBillNotifications(bills, remindersEnabled)),
    savingsGoalService.list().then((goals) => reconcileSavingsGoalNotifications(goals, remindersEnabled)),
    planService
      .get<{ classes: Parameters<typeof reconcileClassNotifications>[0] }>('student')
      .then((plan) => (plan ? reconcileClassNotifications(plan.classes, remindersEnabled) : undefined)),
  ]);
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(BACKGROUND_SYNC_TASK, async ({ data, error }) => {
  if (error || !data) return;
  // The user tapping a notification is handled elsewhere; this is only for ones that arrive.
  if ('actionIdentifier' in data) return;
  const kind = kindOf(data);
  // Any other known kind (an announcement, an AI reply...) is not a reason to refresh.
  if (kind && kind !== 'sync') return;

  const now = Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) return;
  lastRunAt = now;

  try {
    await refreshRemindersFromServer();
  } catch (err) {
    console.error('[backgroundSync] could not refresh reminders', err);
  }
});

// Expo Go and builds without push support reject this; there is simply no background wake-up then.
Notifications.registerTaskAsync(BACKGROUND_SYNC_TASK).catch((err) => {
  console.warn('[backgroundSync] background task not registered', err);
});
