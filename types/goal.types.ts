export type GoalTypeId = 'study' | 'career' | 'personal' | 'habit';

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  dueLabel: string;
}

export interface Goal {
  id: string;
  type: GoalTypeId;
  tag: string;
  title: string;
  color: string;
  pct: number;
  milestones: Milestone[];
  // targetRole/targetIndustry are career-goal-specific context. targetDate is
  // general — a due date any goal type can have, used to surface goals due
  // "this week" on the Dashboard.
  targetRole?: string;
  targetIndustry?: string;
  targetDate?: string;
}

export type NewGoalInput = Omit<Goal, 'id' | 'pct' | 'milestones'> & {
  milestones?: { title: string; dueLabel: string }[];
};
