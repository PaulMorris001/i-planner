import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { planService } from '@/services/plan.service';
import type { StudentPlan, ExamPlan, ProfessionalPlan } from '@/types/plan.types';

const EMPTY_PLAN: StudentPlan = {
  classes:       [],
  recruitment:   [],
  social_life:   [],
  daily_routine: [],
  other:         [],
};

const EMPTY_EXAM_PLAN: ExamPlan = { exams: [] };

const EMPTY_PROFESSIONAL_PLAN: ProfessionalPlan = {
  currentRole:     '',
  currentIndustry: '',
  careerGoals:     [],
  financialGoals:  [],
  certifications:  [],
};

interface PlanContextValue {
  plan: StudentPlan;
  examPlan: ExamPlan;
  professionalPlan: ProfessionalPlan;
  loading: boolean;
  savePlan: (newPlan: StudentPlan) => Promise<void>;
  updatePlan: (updater: (plan: StudentPlan) => StudentPlan) => Promise<void>;
  saveExamPlan: (newExamPlan: ExamPlan) => Promise<void>;
  saveProfessionalPlan: (newProfessionalPlan: ProfessionalPlan) => Promise<void>;
  toggleExamTopic: (examId: string, topicId: string) => Promise<void>;
  logExamPractice: (examId: string, count: number) => Promise<void>;
  logExamMockScore: (examId: string, score: number) => Promise<void>;
  setExamConfidence: (examId: string, confidence: number) => Promise<void>;
  updateExamPlan: (updater: (exams: ExamPlan['exams']) => ExamPlan['exams']) => Promise<void>;
  refetch: () => Promise<void>;
  clearPlan: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan]                         = useState<StudentPlan>(EMPTY_PLAN);
  const [examPlan, setExamPlan]                 = useState<ExamPlan>(EMPTY_EXAM_PLAN);
  const [professionalPlan, setProfessionalPlan] = useState<ProfessionalPlan>(EMPTY_PROFESSIONAL_PLAN);
  const [loading, setLoading]                   = useState(true);

  const fetchPlans = async () => {
    try {
      const [studentData, examData, professionalData] = await Promise.all([
        planService.get<StudentPlan>('student'),
        planService.get<ExamPlan>('exam'),
        planService.get<ProfessionalPlan>('professional'),
      ]);
      if (studentData)      setPlan(studentData);
      if (examData)         setExamPlan(examData);
      if (professionalData) setProfessionalPlan(professionalData);
    } catch (err) {
      console.error('[PlanProvider] failed to load plans', err);
    }
  };

  useEffect(() => {
    // Wait for a live Firebase user before fetching — on cold start, session
    // rehydration can land a tick after this hook mounts.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPlan(EMPTY_PLAN);
        setExamPlan(EMPTY_EXAM_PLAN);
        setProfessionalPlan(EMPTY_PROFESSIONAL_PLAN);
        setLoading(false);
        return;
      }
      await fetchPlans();
      setLoading(false);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePlan = async (newPlan: StudentPlan) => {
    setPlan(newPlan);
    await planService.save('student', newPlan);
  };

  // Computes inside the setPlan updater so two calls fired back-to-back (e.g.
  // AddClassModal's "add, close, add another") don't have the second overwrite
  // the first from a stale closure snapshot.
  const updatePlan = async (updater: (plan: StudentPlan) => StudentPlan) => {
    let prevPlan: StudentPlan = EMPTY_PLAN;
    let nextPlan: StudentPlan = EMPTY_PLAN;
    setPlan((prev) => {
      prevPlan = prev;
      nextPlan = updater(prev);
      return nextPlan;
    });
    try {
      await planService.save('student', nextPlan);
    } catch (err) {
      setPlan(prevPlan);
      throw err;
    }
  };

  const saveExamPlan = async (newExamPlan: ExamPlan) => {
    setExamPlan(newExamPlan);
    await planService.save('exam', newExamPlan);
  };

  const saveProfessionalPlan = async (newProfessionalPlan: ProfessionalPlan) => {
    setProfessionalPlan(newProfessionalPlan);
    await planService.save('professional', newProfessionalPlan);
  };

  // Computes inside the setExamPlan updater so back-to-back calls (e.g. checking
  // off several topics quickly) don't revert each other. Rolls back and rethrows
  // on save failure so the UI never shows an unpersisted change. Saves the whole
  // plan (not just `exams`) — the backend's save fully overwrites `Plan.data`
  // with no merge, so saving `{ exams }` alone would silently wipe any other
  // ExamPlan field (e.g. savingsGoal) on every topic-toggle/practice-log/etc.
  const updateExamPlan = async (updater: (exams: ExamPlan['exams']) => ExamPlan['exams']) => {
    let prevPlan: ExamPlan = EMPTY_EXAM_PLAN;
    let nextPlan: ExamPlan = EMPTY_EXAM_PLAN;
    setExamPlan((prev) => {
      prevPlan = prev;
      nextPlan = { ...prev, exams: updater(prev.exams) };
      return nextPlan;
    });
    try {
      await planService.save('exam', nextPlan);
    } catch (err) {
      setExamPlan(prevPlan);
      throw err;
    }
  };

  // Shared by Dashboard's "This week" card and the exam progress-tracker screen,
  // which both need to flip a single topic's done state.
  const toggleExamTopic = (examId: string, topicId: string) =>
    updateExamPlan((exams) =>
      exams.map((e) =>
        e.id === examId
          ? { ...e, topics: e.topics?.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)) }
          : e
      )
    );

  const logExamPractice = (examId: string, count: number) =>
    updateExamPlan((exams) =>
      exams.map((e) => (e.id === examId ? { ...e, practiceQuestionsLogged: (e.practiceQuestionsLogged ?? 0) + count } : e))
    );

  const logExamMockScore = (examId: string, score: number) =>
    updateExamPlan((exams) =>
      exams.map((e) => (e.id === examId ? { ...e, mockScores: [...(e.mockScores ?? []), score] } : e))
    );

  const setExamConfidence = (examId: string, confidence: number) =>
    updateExamPlan((exams) => exams.map((e) => (e.id === examId ? { ...e, confidence } : e)));

  const clearPlan = () => {
    setPlan(EMPTY_PLAN);
    setExamPlan(EMPTY_EXAM_PLAN);
    setProfessionalPlan(EMPTY_PROFESSIONAL_PLAN);
  };

  return (
    <PlanContext.Provider
      value={{
        plan, examPlan, professionalPlan, loading,
        savePlan, updatePlan, saveExamPlan, saveProfessionalPlan, toggleExamTopic,
        logExamPractice, logExamMockScore, setExamConfidence, updateExamPlan,
        refetch: fetchPlans, clearPlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
