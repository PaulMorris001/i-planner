export type GoalTypeId = 'study' | 'career' | 'personal' | 'habit';

export interface Goal {
  id: string;
  type: GoalTypeId;
  tag: string;
  title: string;
  color: string;
  pct: number;
}

export type NewGoalInput = Omit<Goal, 'id' | 'pct'>;
