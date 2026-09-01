export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string; // "YYYY-MM-DD" — from SavingsGoalModal's date picker.
}

export interface NewSavingsGoalInput {
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
}
