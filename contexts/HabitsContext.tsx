import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { habitService } from '@/services/habit.service';
import type { Habit, NewHabitInput } from '@/types/habit.types';
import { weekdayIndexMonday } from '@/utils/date';

interface HabitsContextValue {
  habits: Habit[];
  loading: boolean;
  createHabit: (input: NewHabitInput) => Promise<void>;
  toggleToday: (id: string) => Promise<void>;
  updateHabit: (id: string, patch: Partial<NewHabitInput>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHabits = async () => {
    try {
      setHabits(await habitService.list());
    } catch (err) {
      console.error('[HabitsProvider] failed to load habits', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setHabits([]);
        setLoading(false);
        return;
      }
      await fetchHabits();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createHabit = async (input: NewHabitInput) => {
    const tempId = `temp-${Date.now()}`;
    setHabits((prev) => [
      ...prev,
      {
        ...input,
        id: tempId,
        createdAt: new Date().toISOString(),
        completedDates: [],
        streak: 0,
        week: [false, false, false, false, false, false, false],
        doneToday: false,
      },
    ]);
    try {
      const created = await habitService.create(input);
      setHabits((prev) => prev.map((h) => (h.id === tempId ? created : h)));
    } catch (err) {
      setHabits((prev) => prev.filter((h) => h.id !== tempId));
      throw err;
    }
  };

  const toggleToday = async (id: string) => {
    const prevHabits = habits;
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const doneToday = !h.doneToday;
        const week = [...h.week];
        week[weekdayIndexMonday(new Date())] = doneToday;
        return { ...h, week, doneToday, streak: Math.max(0, h.streak + (doneToday ? 1 : -1)) };
      })
    );
    try {
      const updated = await habitService.toggleToday(id);
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      setHabits(prevHabits);
      console.error('[HabitsProvider] failed to toggle habit', err);
    }
  };

  const updateHabit = async (id: string, patch: Partial<NewHabitInput>) => {
    const prevHabits = habits;
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    try {
      const updated = await habitService.update(id, patch);
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      setHabits(prevHabits);
      throw err;
    }
  };

  const deleteHabit = async (id: string) => {
    const prevHabits = habits;
    setHabits((prev) => prev.filter((h) => h.id !== id));
    try {
      await habitService.remove(id);
    } catch (err) {
      setHabits(prevHabits);
      throw err;
    }
  };

  return (
    <HabitsContext.Provider value={{ habits, loading, createHabit, toggleToday, updateHabit, deleteHabit, refetch: fetchHabits }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within a HabitsProvider');
  return ctx;
}
