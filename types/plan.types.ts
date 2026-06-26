// ── Student plan item types ────────────────────────────────────────────────
export interface ClassItem {
  id:         string;
  courseName: string;
  days:       string[];
  time:       string;
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
export interface Exam {
  id:             string;
  name:           string;
  subject:        string;
  examDate:       string;
  hoursPerWeek:   number;
  weeksRemaining: number;
}

export interface ExamPlan {
  exams: Exam[];
}