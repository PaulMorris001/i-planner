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

  // Same reasoning/pattern as updateExamPlan below — callers used to build
  // `{ ...plan, classes: ... }` from their own render-closure copy of `plan`,
  // so e.g. AddClassModal's "add a class, close, immediately add another"
  // flow (it doesn't await the save before closing) could have the second
  // add computed from a `plan` that doesn't yet include the first one,
  // silently dropping it once both saves resolve.
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

  // Computes the next exams array inside the setExamPlan updater — against
  // React's latest pending state, not whatever `examPlan` this closure was
  // created with — so two of these fired back-to-back (e.g. checking off
  // several exam topics in quick succession, or deleting two exams one
  // right after the other, before the first request lands) don't have the
  // second call compute its patch from a snapshot that predates the first
  // call's change, silently reverting it once both network requests
  // resolve. Also rolls the optimistic update back on save failure — rather
  // than leaving the UI showing a change that was never actually persisted —
  // and rethrows so callers can still show their own error message.
  const updateExamPlan = async (updater: (exams: ExamPlan['exams']) => ExamPlan['exams']) => {
    let prevExams: ExamPlan['exams'] = [];
    let nextExams: ExamPlan['exams'] = [];
    setExamPlan((prev) => {
      prevExams = prev.exams;
      nextExams = updater(prev.exams);
      return { exams: nextExams };
    });
    try {
      await planService.save('exam', { exams: nextExams });
    } catch (err) {
      setExamPlan((prev) => ({ ...prev, exams: prevExams }));
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

  // Real persisted counterparts to what cert-tracker.tsx used to fake with
  // local-only useState (a hardcoded +10 per tap, and a formulaic increasing
  // "mock score" nobody actually entered) — see plan file for that fix.
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
