import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { savingsGoalService } from '@/services/savingsGoal.service';
import type { SavingsGoal, NewSavingsGoalInput } from '@/types/savingsGoal.types';

interface SavingsGoalsContextValue {
  goals: SavingsGoal[];
  loading: boolean;
  createGoal: (input: NewSavingsGoalInput) => Promise<void>;
  updateGoal: (id: string, patch: Partial<NewSavingsGoalInput>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const SavingsGoalsContext = createContext<SavingsGoalsContextValue | null>(null);

// Soonest target date first — same convention as Bills' due-date sort.
function sortByTargetDate(goals: SavingsGoal[]): SavingsGoal[] {
  return [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

export function SavingsGoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    try {
      setGoals(sortByTargetDate(await savingsGoalService.list()));
    } catch (err) {
      console.error('[SavingsGoalsProvider] failed to load savings goals', err);
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

  const createGoal = async (input: NewSavingsGoalInput) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setGoals((prev) => sortByTargetDate([...prev, { ...input, id: tempId }]));
    try {
      const created = await savingsGoalService.create(input);
      setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === tempId ? created : g))));
    } catch (err) {
      setGoals((prev) => prev.filter((g) => g.id !== tempId));
      throw err;
    }
  };

  const updateGoal = async (id: string, patch: Partial<NewSavingsGoalInput>) => {
    const prevGoals = goals;
    setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === id ? { ...g, ...patch } : g))));
    try {
      const updated = await savingsGoalService.update(id, patch);
      setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === id ? updated : g))));
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    const prevGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await savingsGoalService.remove(id);
    } catch (err) {
      setGoals(prevGoals);
      console.error('[SavingsGoalsProvider] failed to delete savings goal', err);
    }
  };

  return (
    <SavingsGoalsContext.Provider value={{ goals, loading, createGoal, updateGoal, deleteGoal, refetch: fetchGoals }}>
      {children}
    </SavingsGoalsContext.Provider>
  );
}

export function useSavingsGoals() {
  const ctx = useContext(SavingsGoalsContext);
  if (!ctx) throw new Error('useSavingsGoals must be used within a SavingsGoalsProvider');
  return ctx;
}
