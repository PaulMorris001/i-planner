import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { billService } from '@/services/bill.service';
import { useSettings } from '@/hooks/useSettings';
import { scheduleBillNotifications, cancelNotifications } from '@/utils/notifications';
import type { Bill, NewBillInput } from '@/types/bill.types';

interface BillsContextValue {
  bills: Bill[];
  loading: boolean;
  createBill: (input: NewBillInput) => Promise<void>;
  updateBill: (id: string, patch: Partial<NewBillInput>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  markBillPaidCycle: (id: string, cycleDateKey: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const BillsContext = createContext<BillsContextValue | null>(null);

// Soonest-due first.
function sortByDueDate(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function BillsProvider({ children }: { children: ReactNode }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const { remindersEnabled } = useSettings();

  const fetchBills = async () => {
    try {
      setBills(sortByDueDate(await billService.list()));
    } catch (err) {
      console.error('[BillsProvider] failed to load bills', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setBills([]);
        setLoading(false);
        return;
      }
      await fetchBills();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBill = async (input: NewBillInput) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notificationIds = remindersEnabled ? await scheduleBillNotifications(input) : [];
    const toCreate = { ...input, ...(notificationIds.length ? { notificationIds } : {}) };
    setBills((prev) => sortByDueDate([...prev, { ...toCreate, id: tempId }]));
    try {
      const created = await billService.create(toCreate);
      setBills((prev) => sortByDueDate(prev.map((b) => (b.id === tempId ? created : b))));
    } catch (err) {
      setBills((prev) => prev.filter((b) => b.id !== tempId));
      throw err;
    }
  };

  const updateBill = async (id: string, patch: Partial<NewBillInput>) => {
    const prevBills = bills;
    const current = bills.find((b) => b.id === id);

    let finalPatch: Partial<NewBillInput> = patch;
    if (current) {
      const merged = { ...current, ...patch };
      // Cancel unconditionally — real on-device notifications regardless of the
      // current toggle; only creating new ones is gated by it (see TasksContext's
      // updateTask, fixed the same way earlier — don't reintroduce that bug here).
      await cancelNotifications(current.notificationIds);
      finalPatch = {
        ...finalPatch,
        notificationIds: remindersEnabled ? await scheduleBillNotifications(merged) : [],
      };
    }

    setBills((prev) => sortByDueDate(prev.map((b) => (b.id === id ? { ...b, ...finalPatch } : b))));
    try {
      const updated = await billService.update(id, finalPatch);
      setBills((prev) => sortByDueDate(prev.map((b) => (b.id === id ? updated : b))));
    } catch (err) {
      setBills(prevBills);
      throw err;
    }
  };

  // Deliberately bypasses updateBill's unconditional cancel+reschedule dance —
  // this only flips a display flag, it doesn't touch the schedule, and a
  // recurring bill's notification is one native MONTHLY trigger that can't be
  // silenced for a single cycle anyway (see scheduleBillNotifications).
  const markBillPaidCycle = async (id: string, cycleDateKey: string) => {
    const prevBills = bills;
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, lastPaidCycle: cycleDateKey } : b)));
    try {
      const updated = await billService.update(id, { lastPaidCycle: cycleDateKey });
      setBills((prev) => sortByDueDate(prev.map((b) => (b.id === id ? updated : b))));
    } catch (err) {
      setBills(prevBills);
      throw err;
    }
  };

  const deleteBill = async (id: string) => {
    const prevBills = bills;
    const target = bills.find((b) => b.id === id);
    setBills((prev) => prev.filter((b) => b.id !== id));
    try {
      await billService.remove(id);
    } catch (err) {
      setBills(prevBills);
      console.error('[BillsProvider] failed to delete bill', err);
      return;
    }
    // Unconditional — same reasoning as updateBill above.
    if (target?.notificationIds) await cancelNotifications(target.notificationIds);
  };

  return (
    <BillsContext.Provider
      value={{ bills, loading, createBill, updateBill, deleteBill, markBillPaidCycle, refetch: fetchBills }}
    >
      {children}
    </BillsContext.Provider>
  );
}

export function useBills() {
  const ctx = useContext(BillsContext);
  if (!ctx) throw new Error('useBills must be used within a BillsProvider');
  return ctx;
}
