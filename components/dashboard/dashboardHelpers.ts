import type { Exam } from '@/types/plan.types';

// Which of the exam's generated topics (1-based week numbers) is "this week",
// counted backward from the exam date — the last topic lands in the exam's
// final week, the first as far back as the topic count allows.
export function currentExamWeek(exam: Exam): number {
  const totalWeeks = exam.topics?.length || exam.weeksRemaining;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksUntilExam = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / msPerWeek);
  return Math.min(totalWeeks, Math.max(1, totalWeeks - weeksUntilExam + 1));
}
