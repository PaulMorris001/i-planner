import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { taskService } from '@/services/task.service';
import { useSettings } from '@/hooks/useSettings';
import { syncTaskToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleTaskNotifications, cancelNotifications } from '@/utils/notifications';
import { toDateKey } from '@/utils/date';
import type { Task, NewTaskInput } from '@/types/task.types';

// Fields that affect scheduling — shared between Apple Calendar sync and reminder
// notifications; an unnecessary notes-only reschedule is harmless.
const SYNC_RELEVANT_FIELDS = ['title', 'dueDate', 'time', 'notes', 'recurring', 'freq', 'dayIdxs'] as const;

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  createTask: (input: NewTaskInput) => Promise<void>;
  toggleDone: (id: string, date: Date) => Promise<void>;
  updateTask: (id: string, patch: Partial<NewTaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  refetch: () => Promise<Task[]>;
  syncExternallyCreatedTask: (task: Task) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { appleCalendarConnected, remindersEnabled } = useSettings();

  const fetchTasks = async (): Promise<Task[]> => {
    try {
      const list = await taskService.list();
      setTasks(list);
      return list;
    } catch (err) {
      console.error('[TasksProvider] failed to load tasks', err);
      return [];
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTasks([]);
        setLoading(false);
        return;
      }
      await fetchTasks();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTask = async (input: NewTaskInput) => {
    // Random suffix, not just Date.now() — SyllabusUploadModal fires createTask for
    // several deadlines synchronously (Promise.allSettled), so a timestamp alone
    // can collide within the same millisecond and corrupt the optimistic replace below.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setTasks((prev) => [...prev, { ...input, id: tempId, done: false }]);
    // Apple sync and reminder scheduling run client-side, so do both first and let the
    // resulting ids ride along on the create request. Skipped when input already has
    // appleEventIds — that means we're importing an existing Apple event (see TaskDraft),
    // and syncing again would create a duplicate. Google-sourced conversions still get
    // synced since there's no existing Apple event for them.
    const alreadyLinkedApple = !!input.appleEventIds?.length;
    const appleEventIds = !alreadyLinkedApple && appleCalendarConnected ? await syncTaskToAppleCalendar(input) : (input.appleEventIds ?? []);
    const notificationIds = remindersEnabled ? await scheduleTaskNotifications(input) : [];
    const toCreate = {
      ...input,
      ...(appleEventIds.length ? { appleEventIds } : {}),
      ...(notificationIds.length ? { notificationIds } : {}),
    };
    try {
      const created = await taskService.create(toCreate);
      setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)));
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      throw err;
    }
  };

  // A recurring task is one document shared across every weekday it occurs on, so
  // toggling `done` globally would mark every occurrence done at once. Completion is
  // tracked per date in `completedDates` instead; a one-time task keeps the single-`done`
  // path, including reminder cancel/reschedule (a recurring task's reminder repeats
  // weekly and isn't tied to one date).
  const toggleDone = async (id: string, date: Date) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    if (target.recurring) {
      const dateKey = toDateKey(date);
      // Computed inside the updater against React's latest pending state so two toggles
      // fired back-to-back (e.g. the same recurring task on two Week-view columns) don't
      // silently drop one.
      let prevDates: string[] = [];
      let nextDates: string[] = [];
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          prevDates = t.completedDates ?? [];
          nextDates = prevDates.includes(dateKey)
            ? prevDates.filter((d) => d !== dateKey)
            : [...prevDates, dateKey];
          return { ...t, completedDates: nextDates };
        })
      );
      try {
        await taskService.update(id, { completedDates: nextDates });
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completedDates: prevDates } : t)));
        console.error('[TasksProvider] failed to toggle recurring task occurrence', err);
      }
      return;
    }

    const nextDone = !target.done;
    const prevNotificationIds = target.notificationIds;

    // Reads `target`, not the freshest state, since scheduling is an async device call
    // that has to happen before the state update either way — a rapid double-tap race
    // here is accepted, unlike the recurring branch above.
    let notificationIds = target.notificationIds;
    if (nextDone) {
      // Cancel unconditionally — these are real on-device notifications regardless of
      // whether reminders are currently enabled; only scheduling new ones is gated.
      await cancelNotifications(target.notificationIds);
      notificationIds = [];
    } else if (remindersEnabled) {
      notificationIds = await scheduleTaskNotifications(target);
    }

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone, notificationIds } : t)));
    try {
      await taskService.update(id, { done: nextDone, notificationIds });
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !nextDone, notificationIds: prevNotificationIds } : t)));
      console.error('[TasksProvider] failed to toggle task', err);
    }
  };

  const updateTask = async (id: string, patch: Partial<NewTaskInput>) => {
    const prevTasks = tasks;
    const current = tasks.find((t) => t.id === id);

    // Only resync the calendar event / reminder when a field that actually
    // affects them changed — not for a bare done-toggle.
    let finalPatch: Partial<NewTaskInput> = patch;
    const syncRelevant = SYNC_RELEVANT_FIELDS.some((k) => k in patch);
    if (syncRelevant && current) {
      const merged = { ...current, ...patch };
      // A task converted from an imported calendar event points appleEventIds at an
      // event the app doesn't own — deleting/recreating it (the normal resync path)
      // would delete the user's real calendar entry, so only the app's copy changes.
      // The old event/notifications are cancelled unconditionally — they're real
      // already-scheduled state regardless of the current toggle; only creating new
      // ones is gated by whether that toggle is currently on.
      if (!current.calendarLinkExternal) {
        await deleteAppleEvents(current.appleEventIds);
        finalPatch = {
          ...finalPatch,
          appleEventIds: appleCalendarConnected ? await syncTaskToAppleCalendar(merged) : [],
        };
      }
      await cancelNotifications(current.notificationIds);
      finalPatch = {
        ...finalPatch,
        notificationIds: remindersEnabled ? await scheduleTaskNotifications(merged) : [],
      };
    }

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...finalPatch } : t)));
    try {
      const updated = await taskService.update(id, finalPatch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setTasks(prevTasks);
      throw err;
    }
  };

  // For tasks created by a backend-only path (the AI Coach's create_task tool) — Apple
  // sync and notifications only happen client-side, so this runs them after the fact.
  // Takes the task itself rather than an id: caller (coach.tsx) awaits refetch() then
  // this in the same handler, so this closure's `tasks` is still the pre-refetch
  // snapshot and a lookup here would always miss.
  const syncExternallyCreatedTask = async (task: Task) => {
    const appleEventIds = appleCalendarConnected ? await syncTaskToAppleCalendar(task) : [];
    const notificationIds = remindersEnabled ? await scheduleTaskNotifications(task) : [];
    if (!appleEventIds.length && !notificationIds.length) return;
    const patch: Partial<NewTaskInput> = {};
    if (appleEventIds.length) patch.appleEventIds = appleEventIds;
    if (notificationIds.length) patch.notificationIds = notificationIds;
    try {
      const updated = await taskService.update(task.id, patch);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      console.error('[TasksProvider] failed to sync externally-created task', err);
    }
  };

  const removeTask = async (id: string) => {
    const prevTasks = tasks;
    const target = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await taskService.remove(id);
    } catch (err) {
      setTasks(prevTasks);
      console.error('[TasksProvider] failed to remove task', err);
      return;
    }
    // Same reasoning as updateTask above — deleting a converted task from the app must
    // not delete the user's real external calendar event. Both cancellations run
    // unconditionally (regardless of the current appleCalendarConnected/remindersEnabled
    // toggles) — these ids are real already-scheduled state that would otherwise orphan:
    // the task is gone, so nothing would ever catch and cancel them later.
    if (target?.appleEventIds && !target.calendarLinkExternal) {
      await deleteAppleEvents(target.appleEventIds);
    }
    if (target?.notificationIds) await cancelNotifications(target.notificationIds);
  };

  return (
    <TasksContext.Provider
      value={{ tasks, loading, createTask, toggleDone, updateTask, removeTask, refetch: fetchTasks, syncExternallyCreatedTask }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
}
