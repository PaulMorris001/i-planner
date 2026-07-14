import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { goalService } from '@/services/goal.service';
import type { Goal, NewGoalInput } from '@/types/goal.types';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setGoals([]);
        setLoading(false);
        return;
      }
      try {
        setGoals(await goalService.list());
      } catch (err) {
        console.error('[useGoals] failed to load goals', err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const createGoal = async (input: NewGoalInput) => {
    const tempId = `temp-${Date.now()}`;
    setGoals((prev) => [...prev, { ...input, id: tempId, pct: 0, milestones: [] }]);
    try {
      const created = await goalService.create(input);
      setGoals((prev) => prev.map((g) => (g.id === tempId ? created : g)));
    } catch (err) {
      setGoals((prev) => prev.filter((g) => g.id !== tempId));
      throw err;
    }
  };

  const updateGoal = async (
    id: string,
    patch: Partial<Pick<Goal, 'milestones' | 'title' | 'tag' | 'color'>>
  ) => {
    const prevGoals = goals;
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    try {
      const updated = await goalService.update(id, patch);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  return { goals, loading, createGoal, updateGoal };
}
