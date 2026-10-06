// Points for everyday activity. Everything here can be changed in this one file
// (no app release needed). Referral points live in constants/referral.ts.
//
// There are no daily caps. What stops double-paying is that every award is
// recorded against the specific thing it was for (see models/PointEvent.ts), and
// the server refuses a second award for that same thing.
export const POINTS = {
  task: 2, // completing a task (or one occurrence of a recurring task)
  milestone: 5, // completing a goal milestone
  goalDone: 25, // every milestone of a goal completed
  habit: 2, // a habit check-in (once per habit per day)
  habitStreak7: 5, // a 7 day streak (once per streak)
  habitStreak30: 25, // a 30 day streak (once per streak)
  bill: 8, // paying a bill (one cycle of a recurring bill)
  billOnTime: 2, // extra when paid on or before the due date
  savingsUpdate: 3, // adding money to a savings goal (once per goal per day)
  savingsDone: 10, // a savings goal reaching its target
  studyPerBlock: 2, // per full study block of active (unpaused) time
} as const;

// Something created less than this long before you complete it earns nothing:
// stops "create a task and tick it straight away" point farming.
export const MIN_ITEM_AGE_MS = 10 * 60 * 1000;

// Study time: points per full block of active time, and the least active time
// for a session to be logged at all.
export const STUDY_BLOCK_MS = 30 * 60 * 1000;
export const STUDY_MIN_LOGGED_MS = 10 * 60 * 1000;
