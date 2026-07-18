import { Task } from '../models/Task';
import { Goal } from '../models/Goal';
import { Habit, toPublicHabit } from '../models/Habit';
import { Plan } from '../models/Plan';

// Minimal shapes needed here — Classes/Exams are schemaless (Plan.data), same
// reasoning as elsewhere in this backend for not sharing a types package with
// the app (see Task.ts's category/priority fields).
interface ClassRecord {
  courseName: string;
  dayIdxs: number[];
  time: string;
}

interface ExamTopicRecord {
  title: string;
  week: number;
  done: boolean;
}

interface ExamRecord {
  name: string;
  examDate: string;
  weeksRemaining: number;
  topics?: ExamTopicRecord[];
}

function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function currentExamWeek(exam: ExamRecord): number {
  const totalWeeks = exam.topics?.length || exam.weeksRemaining;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksUntilExam = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / msPerWeek);
  return Math.min(totalWeeks, Math.max(1, totalWeeks - weeksUntilExam + 1));
}

// Builds a compact text summary of the user's real planner data, dropped into
// the Coach's system prompt so it can give personalized (not generic) answers.
// Shared across all 3 modes rather than mode-specific queries — simpler than
// bespoke fetching per mode, and the system prompt's per-mode framing already
// steers which parts of this the assistant actually leans on.
export async function buildContextSummary(firebaseUid: string): Promise<string> {
  const [tasks, goals, habits, studentPlan, examPlan] = await Promise.all([
    Task.find({ firebaseUid }),
    Goal.find({ firebaseUid }),
    Habit.find({ firebaseUid }),
    Plan.findOne({ firebaseUid, pathType: 'student' }),
    Plan.findOne({ firebaseUid, pathType: 'exam' }),
  ]);

  const sections: string[] = [];
  const now = Date.now();
  const todayIdx = weekdayIndexMonday(new Date());

  const upcomingTasks = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, 15);
  if (upcomingTasks.length) {
    sections.push(
      'TASKS (not done, soonest due first):\n' +
      upcomingTasks
        .map((t) => {
          const due = t.dueDate ? ` — due ${new Date(t.dueDate).toDateString()}${t.time ? ` ${t.time}` : ''}` : ' — no due date';
          return `- "${t.title}" [${t.category}/${t.priority}]${due}${t.recurring ? ' (recurring)' : ''}`;
        })
        .join('\n')
    );
  }

  if (goals.length) {
    sections.push(
      'GOALS:\n' +
      goals
        .map((g) => {
          const next = g.milestones.find((m) => !m.done);
          return `- "${g.title}" (${g.type}) — ${g.pct}% complete${
            next ? `, next milestone: "${next.title}"` : ', all milestones complete'
          }`;
        })
        .join('\n')
    );
  }

  if (habits.length) {
    sections.push(
      'HABITS:\n' +
      habits
        .map(toPublicHabit)
        .map((h) => `- "${h.name}" — ${h.doneToday ? 'done today' : 'not done today'}, ${h.streak}-day streak`)
        .join('\n')
    );
  }

  const studentData = studentPlan?.data as { classes?: ClassRecord[] } | undefined;
  const classesToday = (studentData?.classes ?? []).filter((c) => (c.dayIdxs ?? []).includes(todayIdx));
  if (classesToday.length) {
    sections.push(
      "TODAY'S CLASSES:\n" + classesToday.map((c) => `- "${c.courseName}" at ${c.time}`).join('\n')
    );
  }

  const examData = examPlan?.data as { exams?: ExamRecord[] } | undefined;
  const exams = examData?.exams ?? [];
  if (exams.length) {
    sections.push(
      'EXAMS:\n' +
      exams
        .map((e) => {
          const daysUntil = Math.max(0, Math.ceil((new Date(e.examDate).getTime() - now) / (1000 * 60 * 60 * 24)));
          const week = currentExamWeek(e);
          const currentTopic = e.topics?.find((t) => t.week === week);
          const done = e.topics?.filter((t) => t.done).length ?? 0;
          const total = e.topics?.length ?? 0;
          return (
            `- "${e.name}" — ${daysUntil} days away, Week ${week}` +
            `${currentTopic ? `, this week's topic: "${currentTopic.title}"` : ''}` +
            `${total > 0 ? `, ${done}/${total} topics complete` : ''}`
          );
        })
        .join('\n')
    );
  }

  return sections.length
    ? sections.join('\n\n')
    : 'The user has no tasks, goals, habits, classes, or exams set up yet.';
}
