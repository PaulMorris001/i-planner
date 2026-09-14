// ── Student plan item types ────────────────────────────────────────────────
export type ClassFrequency = "weekly" | "weekdays" | "daily" | "monthly";

export interface ClassItem {
  id: string;
  courseName: string;
  startDate: string;
  // Only meaningful when recurring is true — the class stops actually
  // occurring after this date (e.g. the semester's last day). Absent means
  // it recurs indefinitely, the original (and still default) behavior.
  // Notification triggers have no native way to expire themselves at this
  // date (see utils/notifications.ts/scheduleClassNotifications) — this is
  // enforced live for display (utils/date.ts's classOccursOnDate) and
  // best-effort for already-scheduled reminders (cancelled the next time
  // this device reconciles, see utils/notificationReconcile.ts).
  endDate?: string;
  recurring: boolean;
  freq: ClassFrequency;
  dayIdxs: number[]; // Monday-start weekday indices (0=Mon..6=Sun) this class occurs on
  time: string;
  professor?: string;
  venue?: string;
  alarmEnabled?: boolean;
  appleEventIds?: string[];
  googleEventId?: string;
  notificationIds?: string[];
}

export interface RecruitmentItem {
  id: string;
  taskType: "Apply" | "Interview" | "Network" | "Update CV" | "Other";
  company: string;
  date: string;
}

export interface SocialItem {
  id: string;
  activity: string;
  frequency: "One-off" | "Weekly" | "Monthly";
}

export interface RoutineItem {
  id: string;
  name: string;
  timeOfDay: "Morning" | "Afternoon" | "Evening" | "Night";
}

export interface OtherItem {
  id: string;
  title: string;
  date: string;
}

export interface StudentPlan {
  classes: ClassItem[];
  recruitment: RecruitmentItem[];
  social_life: SocialItem[];
  daily_routine: RoutineItem[];
  other: OtherItem[];
}

// Legacy (keep for backward compat)
export interface PlanItem {
  id: string;
  title: string;
  date: string;
}

export type PlanCategory =
  | "classes"
  | "recruitment"
  | "social_life"
  | "daily_routine"
  | "other";

//Exam types
export interface ExamTopic {
  id: string;
  title: string;
  week: number;
  done: boolean;
}

export interface Exam {
  id: string;
  name: string;
  subject: string;
  examDate: string;
  hoursPerWeek: number;
  weeksRemaining: number;
  topics?: ExamTopic[];
  practiceQuestionsLogged?: number;
  mockScores?: number[];
  confidence?: number;
}

export interface ExamPlan {
  exams: Exam[];
}

//Professional plan types
export interface CareerGoal {
  id: string;
  goal: string;
  targetYear: string;
}

export interface FinancialGoal {
  id: string;
  goal: string;
  targetAmount: string;
  targetYear: string;
}

export interface ProfessionalPlan {
  currentRole: string;
  currentIndustry: string;
  careerGoals: CareerGoal[];
  financialGoals: FinancialGoal[];
  certifications: string[];
}
