export type CoachModeId = 'study' | 'plan' | 'goal';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
