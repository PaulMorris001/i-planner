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
  saveExamPlan: (newExamPlan: ExamPlan) => Promise<void>;
  saveProfessionalPlan: (newProfessionalPlan: ProfessionalPlan) => Promise<void>;
  toggleExamTopic: (examId: string, topicId: string) => Promise<void>;
  clearPlan: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan]                         = useState<StudentPlan>(EMPTY_PLAN);
  const [examPlan, setExamPlan]                 = useState<ExamPlan>(EMPTY_EXAM_PLAN);
  const [professionalPlan, setProfessionalPlan] = useState<ProfessionalPlan>(EMPTY_PROFESSIONAL_PLAN);
  const [loading, setLoading]                   = useState(true);

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
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const savePlan = async (newPlan: StudentPlan) => {
    setPlan(newPlan);
    await planService.save('student', newPlan);
  };

  const saveExamPlan = async (newExamPlan: ExamPlan) => {
    setExamPlan(newExamPlan);
    await planService.save('exam', newExamPlan);
  };

  const saveProfessionalPlan = async (newProfessionalPlan: ProfessionalPlan) => {
    setProfessionalPlan(newProfessionalPlan);
    await planService.save('professional', newProfessionalPlan);
  };

  // Shared by Dashboard's "This week" card and the exam progress-tracker screen,
  // which both need to flip a single topic's done state.
  const toggleExamTopic = async (examId: string, topicId: string) => {
    const updatedExams = examPlan.exams.map((e) =>
      e.id === examId
        ? { ...e, topics: e.topics?.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)) }
        : e
    );
    await saveExamPlan({ exams: updatedExams });
  };

  const clearPlan = () => {
    setPlan(EMPTY_PLAN);
    setExamPlan(EMPTY_EXAM_PLAN);
    setProfessionalPlan(EMPTY_PROFESSIONAL_PLAN);
  };

  return (
    <PlanContext.Provider
      value={{
        plan, examPlan, professionalPlan, loading,
        savePlan, saveExamPlan, saveProfessionalPlan, toggleExamTopic, clearPlan,
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
