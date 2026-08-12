// Shared between app/(app)/profile.tsx's "AI Data Access" toggles and
// components/coach/AiDisclosureGate.tsx's one-time consent screen, so both
// describe the exact same three categories the same way.
export const CONSENT_ROWS = [
  {
    key: "aiAccessTasks",
    label: "Tasks & deadlines",
    desc: "Lets the AI plan around your to-dos",
  },
  {
    key: "aiAccessGoals",
    label: "Goals & milestones",
    desc: "Lets the AI connect tasks to your goals",
  },
  {
    key: "aiAccessCalendar",
    label: "Calendar events",
    desc: "Lets the AI schedule around your day",
  },
] as const;
