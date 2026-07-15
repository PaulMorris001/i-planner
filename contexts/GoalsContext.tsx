import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { goalService } from '@/services/goal.service';
import type { Goal, Milestone, NewGoalInput } from '@/types/goal.types';

// Mirrors the backend's pct derivation (goal.controller.ts) so the optimistic local
// update can move the progress bar immediately instead of waiting on the round trip.
function pctFromMilestones(milestones: Pick<Milestone, 'done'>[]): number {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

type GoalUpdatePatch = Partial<
  Pick<Goal, 'milestones' | 'title' | 'tag' | 'color' | 'type' | 'targetRole' | 'targetIndustry' | 'targetDate'>
>;

interface GoalsContextValue {
  goals: Goal[];
  loading: boolean;
  createGoal: (input: NewGoalInput) => Promise<void>;
  updateGoal: (id: string, patch: GoalUpdatePatch) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
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
        console.error('[GoalsProvider] failed to load goals', err);
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

  const updateGoal = async (id: string, patch: GoalUpdatePatch) => {
    const prevGoals = goals;
    const optimisticPatch = patch.milestones
      ? { ...patch, pct: pctFromMilestones(patch.milestones) }
      : patch;
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...optimisticPatch } : g)));
    try {
      const updated = await goalService.update(id, patch);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    const prevGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await goalService.remove(id);
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  return (
    <GoalsContext.Provider value={{ goals, loading, createGoal, updateGoal, deleteGoal }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within a GoalsProvider');
  return ctx;
}
