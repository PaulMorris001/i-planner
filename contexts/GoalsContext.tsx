import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { goalService } from '@/services/goal.service';
import type { Goal, Milestone, MilestonePatch, NewGoalInput } from '@/types/goal.types';

// Mirrors the backend's pct derivation (goal.controller.ts) for optimistic
// updates — moves the progress bar without waiting on the round trip.
function pctFromMilestones(milestones: Pick<Milestone, 'done'>[]): number {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

type GoalUpdatePatch = Partial<
  Pick<Goal, 'title' | 'tag' | 'color' | 'type' | 'targetRole' | 'targetIndustry' | 'targetDate'>
> & { milestones?: MilestonePatch[] };

interface GoalsContextValue {
  goals: Goal[];
  loading: boolean;
  createGoal: (input: NewGoalInput) => Promise<void>;
  updateGoal: (id: string, patch: GoalUpdatePatch) => Promise<void>;
  toggleMilestone: (goalId: string, milestoneId: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    try {
      setGoals(await goalService.list());
    } catch (err) {
      console.error('[GoalsProvider] failed to load goals', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setGoals([]);
        setLoading(false);
        return;
      }
      await fetchGoals();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Newly added milestones have no real id yet (backend assigns one), so
    // give them a placeholder for React keys until the server response lands.
    const { milestones: patchMilestones, ...restPatch } = patch;
    const optimisticMilestones: Milestone[] | undefined = patchMilestones?.map((m, i) => ({
      id: m.id ?? `temp-${i}`,
      title: m.title,
      done: m.done ?? false,
      dueLabel: m.dueLabel,
    }));
    const optimisticPatch: Partial<Goal> = {
      ...restPatch,
      ...(optimisticMilestones ? { milestones: optimisticMilestones, pct: pctFromMilestones(optimisticMilestones) } : {}),
    };
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...optimisticPatch } : g)));
    try {
      const updated = await goalService.update(id, patch);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  // Computed inside the setGoals updater (not from the closure's `goals`) so
  // two toggles fired back-to-back on the same goal each read the latest
  // pending state instead of silently reverting each other. Same pattern as
  // PlanContext.updateExamPlan.
  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    const prevGoals = goals;
    let nextMilestones: Milestone[] | undefined;
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        nextMilestones = g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
        return { ...g, milestones: nextMilestones, pct: pctFromMilestones(nextMilestones) };
      })
    );
    if (!nextMilestones) return;
    try {
      const updated = await goalService.update(goalId, { milestones: nextMilestones });
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
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
    <GoalsContext.Provider value={{ goals, loading, createGoal, updateGoal, toggleMilestone, deleteGoal, refetch: fetchGoals }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within a GoalsProvider');
  return ctx;
}
