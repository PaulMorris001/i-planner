import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import type { StudentPlan, ExamPlan } from '@/types/plan.types';

const PLAN_KEY      = '@iplanner_student_plan';
const EXAM_PLAN_KEY = '@iplanner_exam_plan';

const EMPTY_PLAN: StudentPlan = {
  classes:       [],
  recruitment:   [],
  social_life:   [],
  daily_routine: [],
  other:         [],
};

const EMPTY_EXAM_PLAN: ExamPlan = { exams: [] };

export function usePlan() {
  const [plan, setPlan]         = useState<StudentPlan>(EMPTY_PLAN);
  const [examPlan, setExamPlan] = useState<ExamPlan>(EMPTY_EXAM_PLAN);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PLAN_KEY),
      AsyncStorage.getItem(EXAM_PLAN_KEY),
    ]).then(([raw, rawExam]) => {
      if (raw)     setPlan(JSON.parse(raw));
      if (rawExam) setExamPlan(JSON.parse(rawExam));
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

  const clearPlan = async () => {
    await AsyncStorage.multiRemove([PLAN_KEY, EXAM_PLAN_KEY]);
    setPlan(EMPTY_PLAN);
    setExamPlan(EMPTY_EXAM_PLAN);
  };

  return { plan, examPlan, loading, savePlan, saveExamPlan, clearPlan };
}