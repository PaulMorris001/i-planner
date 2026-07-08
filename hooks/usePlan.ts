import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import type { StudentPlan, ExamPlan, ProfessionalPlan } from '@/types/plan.types';

const PLAN_KEY         = '@iplanner_student_plan';
const EXAM_PLAN_KEY    = '@iplanner_exam_plan';
const PROFESSIONAL_PLAN_KEY = '@iplanner_professional_plan';

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

export function usePlan() {
  const [plan, setPlan]                       = useState<StudentPlan>(EMPTY_PLAN);
  const [examPlan, setExamPlan]               = useState<ExamPlan>(EMPTY_EXAM_PLAN);
  const [professionalPlan, setProfessionalPlan] = useState<ProfessionalPlan>(EMPTY_PROFESSIONAL_PLAN);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PLAN_KEY),
      AsyncStorage.getItem(EXAM_PLAN_KEY),
      AsyncStorage.getItem(PROFESSIONAL_PLAN_KEY),
    ]).then(([raw, rawExam, rawProfessional]) => {
      if (raw)             setPlan(JSON.parse(raw));
      if (rawExam)         setExamPlan(JSON.parse(rawExam));
      if (rawProfessional) setProfessionalPlan(JSON.parse(rawProfessional));
      setLoading(false);
    });
  }, []);

  const savePlan = async (newPlan: StudentPlan) => {
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(newPlan));
    setPlan(newPlan);
  };

  const saveExamPlan = async (newExamPlan: ExamPlan) => {
    await AsyncStorage.setItem(EXAM_PLAN_KEY, JSON.stringify(newExamPlan));
    setExamPlan(newExamPlan);
  };

  const saveProfessionalPlan = async (newProfessionalPlan: ProfessionalPlan) => {
    await AsyncStorage.setItem(PROFESSIONAL_PLAN_KEY, JSON.stringify(newProfessionalPlan));
    setProfessionalPlan(newProfessionalPlan);
  };

  const clearPlan = async () => {
    await AsyncStorage.multiRemove([PLAN_KEY, EXAM_PLAN_KEY, PROFESSIONAL_PLAN_KEY]);
    setPlan(EMPTY_PLAN);
    setExamPlan(EMPTY_EXAM_PLAN);
    setProfessionalPlan(EMPTY_PROFESSIONAL_PLAN);
  };

  return {
    plan,
    examPlan,
    professionalPlan,
    loading,
    savePlan,
    saveExamPlan,
    saveProfessionalPlan,
    clearPlan,
  };
}
