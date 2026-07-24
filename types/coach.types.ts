export type CoachModeId = 'study' | 'plan' | 'goal';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// "Plan My Day" replies can carry ids of tasks the AI just created, so the
// client knows to refetch and run the same client-side sync (Apple/reminders)
// that manually-created tasks get.
export interface CoachSendResult extends CoachMessage {
  createdTaskIds?: string[];
}
