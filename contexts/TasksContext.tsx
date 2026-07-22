import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { taskService } from '@/services/task.service';
import { useSettings } from '@/hooks/useSettings';
import { syncTaskToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import { scheduleTaskNotifications, cancelNotifications } from '@/utils/notifications';
import type { Task, NewTaskInput } from '@/types/task.types';

// Fields that affect what's scheduled — the same set for both the Apple Calendar
// event and the local reminder notification (notes only affects the calendar
// event's description, but reusing one set keeps this simple; an unnecessary
// notes-only reschedule is harmless).
const SYNC_RELEVANT_FIELDS = ['title', 'dueDate', 'time', 'notes', 'recurring', 'freq', 'dayIdxs'] as const;

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  createTask: (input: NewTaskInput) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  updateTask: (id: string, patch: Partial<NewTaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { appleCalendarConnected, remindersEnabled } = useSettings();

  const fetchTasks = async () => {
    try {
      setTasks(await taskService.list());
    } catch (err) {
      console.error('[TasksProvider] failed to load tasks', err);
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
    const tempId = `temp-${Date.now()}`;
    setTasks((prev) => [...prev, { ...input, id: tempId, done: false }]);
    // Apple sync and reminder scheduling both run client-side — do both first so
    // the resulting ids ride along on the create request.
    const appleEventIds = appleCalendarConnected ? await syncTaskToAppleCalendar(input) : [];
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

  const toggleDone = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;

    // A completed task doesn't need a reminder anymore; un-completing one that
    // still has a future due date/time should get its reminder back.
    let notificationIds = target.notificationIds;
    if (remindersEnabled) {
      if (nextDone) {
        await cancelNotifications(target.notificationIds);
        notificationIds = [];
      } else {
        notificationIds = await scheduleTaskNotifications(target);
      }
    }

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone, notificationIds } : t)));
    try {
      await taskService.update(id, { done: nextDone, notificationIds });
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !nextDone, notificationIds: target.notificationIds } : t)));
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
      if (appleCalendarConnected) {
        await deleteAppleEvents(current.appleEventIds);
        finalPatch = { ...finalPatch, appleEventIds: await syncTaskToAppleCalendar(merged) };
      }
      if (remindersEnabled) {
        await cancelNotifications(current.notificationIds);
        finalPatch = { ...finalPatch, notificationIds: await scheduleTaskNotifications(merged) };
      }
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
    if (target?.appleEventIds && appleCalendarConnected) await deleteAppleEvents(target.appleEventIds);
    if (target?.notificationIds && remindersEnabled) await cancelNotifications(target.notificationIds);
  };

  return (
    <TasksContext.Provider value={{ tasks, loading, createTask, toggleDone, updateTask, removeTask, refetch: fetchTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
}
