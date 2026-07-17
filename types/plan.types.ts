// ── Student plan item types ────────────────────────────────────────────────
export type ClassFrequency = 'weekly' | 'weekdays' | 'daily' | 'monthly';

export interface ClassItem {
  id:         string;
  courseName: string;
  startDate:  string;   // ISO date this class starts / started
  recurring:  boolean;
  freq:       ClassFrequency;
  dayIdxs:    number[];  // Monday-start weekday indices (0=Mon..6=Sun) this class occurs on
  time:       string;
  // Calendar-sync event ids, one per synced entry (Apple gets one event per
  // dayIdxs occurrence; Google gets a single event with a multi-day RRULE).
  appleEventIds?: string[];
  googleEventId?: string;
  // Locally-scheduled expo-notifications reminder ids — one per dayIdxs
  // occurrence for weekly/weekdays, same reasoning as appleEventIds.
  notificationIds?: string[];
}

export interface RecruitmentItem {
  id:       string;
  taskType: 'Apply' | 'Interview' | 'Network' | 'Update CV' | 'Other';
  company:  string;
  date:     string;
}

export interface SocialItem {
  id:        string;
  activity:  string;
  frequency: 'One-off' | 'Weekly' | 'Monthly';
}

export interface RoutineItem {
  id:        string;
  name:      string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
}

export interface OtherItem {
  id:    string;
  title: string;
  date:  string;
}

export interface StudentPlan {
  classes:       ClassItem[];
  recruitment:   RecruitmentItem[];
  social_life:   SocialItem[];
  daily_routine: RoutineItem[];
  other:         OtherItem[];
}

// ── Legacy (keep for backward compat) ─────────────────────────────────────
export interface PlanItem {
  id:    string;
  title: string;
  date:  string;
}

export type PlanCategory =
  | 'classes'
  | 'recruitment'
  | 'social_life'
  | 'daily_routine'
  | 'other';

// ── Exam types ─────────────────────────────────────────────────────────────
export interface ExamTopic {
  id:    string;
  title: string;
  week:  number; // 1-based, 1..weeksRemaining (as of generation time)
  done:  boolean;
}

export interface Exam {
  id:             string;
  name:           string;
  subject:        string;
  examDate:       string;
  hoursPerWeek:   number;
  weeksRemaining: number;
  // AI-generated week-by-week study topics — undefined/empty until generated
  // (e.g. an exam saved before this feature existed, or generation failed).
  topics?: ExamTopic[];
}

export interface ExamPlan {
  exams: Exam[];
}

// ── Professional plan types ────────────────────────────────────────────────
export interface CareerGoal {
  id:         string;
  goal:       string;
  targetYear: string;
}

export interface FinancialGoal {
  id:           string;
  goal:         string;
  targetAmount: string;
  targetYear:   string;
}

export interface ProfessionalPlan {
  currentRole:     string;
  currentIndustry: string;
  careerGoals:     CareerGoal[];
  financialGoals:  FinancialGoal[];
  certifications:  string[];
}