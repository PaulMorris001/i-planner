import type { Exam } from '@/types/plan.types';

// Which generated topic (1-based week number) is "this week", counted backward from the exam date.
export function currentExamWeek(exam: Exam): number {
  const totalWeeks = exam.topics?.length || exam.weeksRemaining;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksUntilExam = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / msPerWeek);
  return Math.min(totalWeeks, Math.max(1, totalWeeks - weeksUntilExam + 1));
}
