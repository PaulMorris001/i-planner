import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { syllabusService } from '@/services/syllabus.service';
import type { Syllabus } from '@/types/syllabus.types';

interface SyllabiContextValue {
  syllabi: Syllabus[];
  loading: boolean;
  createSyllabus: (input: { fileName: string; courseName: string; classId?: string }) => Promise<void>;
  refetch: () => Promise<void>;
}

const SyllabiContext = createContext<SyllabiContextValue | null>(null);

export function SyllabiProvider({ children }: { children: ReactNode }) {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSyllabi = async () => {
    try {
      setSyllabi(await syllabusService.list());
    } catch (err) {
      console.error('[SyllabiProvider] failed to load syllabi', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSyllabi([]);
        setLoading(false);
        return;
      }
      await fetchSyllabi();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSyllabus = async (input: { fileName: string; courseName: string; classId?: string }) => {
    const created = await syllabusService.create(input);
    setSyllabi((prev) => [created, ...prev]);
  };

  return (
    <SyllabiContext.Provider value={{ syllabi, loading, createSyllabus, refetch: fetchSyllabi }}>
      {children}
    </SyllabiContext.Provider>
  );
}

export function useSyllabi() {
  const ctx = useContext(SyllabiContext);
  if (!ctx) throw new Error('useSyllabi must be used within a SyllabiProvider');
  return ctx;
}
