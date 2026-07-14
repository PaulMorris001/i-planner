import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { taskService } from '@/services/task.service';
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
    try {
      const created = await taskService.create(input);
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
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const updated = await taskService.update(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setTasks(prevTasks);
      throw err;
    }
  };

  const removeTask = async (id: string) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await taskService.remove(id);
    } catch (err) {
      setTasks(prevTasks);
      console.error('[TasksProvider] failed to remove task', err);
    }
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
