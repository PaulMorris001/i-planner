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
  // Career-goal-specific context (unused by other goal types).
  targetRole?: string;
  targetIndustry?: string;
  targetDate?: string;
}

export type NewGoalInput = Omit<Goal, 'id' | 'pct' | 'milestones'> & {
  milestones?: { title: string; dueLabel: string }[];
};
