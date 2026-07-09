import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { habitService } from '@/services/habit.service';
import type { Habit, NewHabitInput } from '@/types/habit.types';

interface HabitsContextValue {
  habits: Habit[];
  loading: boolean;
  createHabit: (input: NewHabitInput) => Promise<void>;
  toggleToday: (id: string) => Promise<void>;
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setHabits([]);
        setLoading(false);
        return;
      }
      try {
        setHabits(await habitService.list());
      } catch (err) {
        console.error('[HabitsProvider] failed to load habits', err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const createHabit = async (input: NewHabitInput) => {
    const tempId = `temp-${Date.now()}`;
    setHabits((prev) => [
      ...prev,
      { ...input, id: tempId, streak: 0, week: [false, false, false, false, false, false, false] },
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
        const week = [...h.week];
        week[1] = !week[1];
        return { ...h, week };
      })
    );
    try {
      await habitService.toggleToday(id);
    } catch (err) {
      setHabits(prevHabits);
      console.error('[HabitsProvider] failed to toggle habit', err);
    }
  };

  return (
    <HabitsContext.Provider value={{ habits, loading, createHabit, toggleToday }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within a HabitsProvider');
  return ctx;
}
