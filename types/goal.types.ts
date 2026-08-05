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

// Used when saving edits to an existing goal's milestones: `id` is present for
// milestones that already exist (so the backend preserves their identity/done
// state) and omitted for ones just added in this edit, which the backend
// assigns a fresh id to.
export type MilestonePatch = Omit<Milestone, 'id'> & { id?: string };
