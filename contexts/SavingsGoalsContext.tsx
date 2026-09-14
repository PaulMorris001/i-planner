import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { savingsGoalService } from '@/services/savingsGoal.service';
import { useSettings } from '@/hooks/useSettings';
import { scheduleSavingsGoalNotifications, cancelNotifications } from '@/utils/notifications';
import {
  reconcileSavingsGoalNotifications,
  markSavingsGoalScheduled,
  clearSavingsGoalSchedule,
} from '@/utils/notificationReconcile';
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
  const { remindersEnabled } = useSettings();

  const fetchGoals = async () => {
    try {
      const list = await savingsGoalService.list();
      // See utils/notificationReconcile.ts — picks up goals created, edited,
      // or deleted on another device.
      const reconciled = await reconcileSavingsGoalNotifications(list, remindersEnabled).catch((err) => {
        console.error('[SavingsGoalsProvider] failed to reconcile savings goal notifications', err);
        return list;
      });
      setGoals(sortByTargetDate(reconciled));
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
    const notificationIds = remindersEnabled ? await scheduleSavingsGoalNotifications(input) : [];
    const toCreate = { ...input, ...(notificationIds.length ? { notificationIds } : {}) };
    setGoals((prev) => sortByTargetDate([...prev, { ...toCreate, id: tempId }]));
    try {
      const created = await savingsGoalService.create(toCreate);
      setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === tempId ? created : g))));
      await markSavingsGoalScheduled(created, notificationIds);
    } catch (err) {
      setGoals((prev) => prev.filter((g) => g.id !== tempId));
      throw err;
    }
  };

  const updateGoal = async (id: string, patch: Partial<NewSavingsGoalInput>) => {
    const prevGoals = goals;
    const current = goals.find((g) => g.id === id);

    let finalPatch: Partial<NewSavingsGoalInput> = patch;
    if (current) {
      const merged = { ...current, ...patch };
      // Cancel unconditionally — real on-device notification regardless of
      // the current toggle; only creating a new one is gated by it (same
      // rule BillsContext.updateBill and TasksContext.updateTask follow).
      await cancelNotifications(current.notificationIds);
      finalPatch = {
        ...finalPatch,
        notificationIds: remindersEnabled ? await scheduleSavingsGoalNotifications(merged) : [],
      };
      await markSavingsGoalScheduled({ ...current, ...finalPatch }, finalPatch.notificationIds ?? []);
    }

    setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === id ? { ...g, ...finalPatch } : g))));
    try {
      const updated = await savingsGoalService.update(id, finalPatch);
      setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === id ? updated : g))));
    } catch (err) {
      setGoals(prevGoals);
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    const prevGoals = goals;
    const target = goals.find((g) => g.id === id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await savingsGoalService.remove(id);
    } catch (err) {
      setGoals(prevGoals);
      console.error('[SavingsGoalsProvider] failed to delete savings goal', err);
      return;
    }
    if (target?.notificationIds) await cancelNotifications(target.notificationIds);
    await clearSavingsGoalSchedule(id);
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
