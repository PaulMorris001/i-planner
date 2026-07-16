import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { taskService } from '@/services/task.service';
import { useSettings } from '@/hooks/useSettings';
import { syncTaskToAppleCalendar, deleteAppleEvents } from '@/utils/appleCalendarSync';
import type { Task, NewTaskInput } from '@/types/task.types';

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  createTask: (input: NewTaskInput) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  updateTask: (id: string, patch: Partial<NewTaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { appleCalendarConnected } = useSettings();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTasks([]);
        setLoading(false);
        return;
      }
      try {
        setTasks(await taskService.list());
      } catch (err) {
        console.error('[TasksProvider] failed to load tasks', err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const createTask = async (input: NewTaskInput) => {
    const tempId = `temp-${Date.now()}`;
    setTasks((prev) => [...prev, { ...input, id: tempId, done: false }]);
    // Apple sync runs client-side (no server-reachable "Apple Calendar API") —
    // sync first so the resulting event id(s) ride along on the create request.
    const appleEventIds = appleCalendarConnected ? await syncTaskToAppleCalendar(input) : [];
    const toCreate = appleEventIds.length ? { ...input, appleEventIds } : input;
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
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
    try {
      await taskService.update(id, { done: nextDone });
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !nextDone } : t)));
      console.error('[TasksProvider] failed to toggle task', err);
    }
  };

  const updateTask = async (id: string, patch: Partial<NewTaskInput>) => {
    const prevTasks = tasks;
    const current = tasks.find((t) => t.id === id);

    // Only resync the calendar event when a field that actually affects it changed —
    // not for a bare done-toggle.
    let finalPatch: Partial<NewTaskInput> = patch;
    const calendarRelevant = (['title', 'dueDate', 'time', 'notes', 'recurring', 'freq', 'dayIdxs'] as const)
      .some((k) => k in patch);
    if (calendarRelevant && current && appleCalendarConnected) {
      await deleteAppleEvents(current.appleEventIds);
      const appleEventIds = await syncTaskToAppleCalendar({ ...current, ...patch });
      finalPatch = { ...patch, appleEventIds };
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
  };

  return (
    <TasksContext.Provider value={{ tasks, loading, createTask, toggleDone, updateTask, removeTask }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
}
