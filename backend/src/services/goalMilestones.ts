export interface MilestoneSuggestion {
  title: string;
  dueLabel: string;
}

const MOCK_MILESTONES: Record<string, MilestoneSuggestion[]> = {
  study: [
    { title: 'Outline the syllabus and key topics', dueLabel: 'This week' },
    { title: 'Complete a first practice test', dueLabel: 'This month' },
    { title: 'Review weak areas', dueLabel: 'Mid-way' },
    { title: 'Take a final mock exam', dueLabel: 'Final stretch' },
  ],
  career: [
    { title: 'Map the skills this role needs', dueLabel: 'This month' },
    { title: 'Find a mentor already in the field', dueLabel: 'Next 2 months' },
    { title: 'Lead a visible cross-team project', dueLabel: 'Mid-way' },
    { title: 'Interview / apply for the role', dueLabel: 'Final stretch' },
  ],
  personal: [
    { title: 'Define what success looks like', dueLabel: 'This week' },
    { title: 'Build a simple daily habit toward it', dueLabel: 'This month' },
    { title: 'Check in on progress', dueLabel: 'Mid-way' },
    { title: 'Celebrate small wins along the way', dueLabel: 'Final stretch' },
  ],
  habit: [
    { title: 'Start with a small, repeatable version', dueLabel: 'This week' },
    { title: 'Track it daily for two weeks', dueLabel: 'This month' },
    { title: 'Push through the mid-point dip', dueLabel: 'Mid-way' },
    { title: 'Make it automatic', dueLabel: 'Final stretch' },
  ],
};

// Stubbed AI milestone generation — returns canned data so the create → review →
// save flow is fully testable before a real LLM call exists. Kept as an async
// function with this exact input/output shape so swapping in a real call later
// (likely shared with the Coach tab) is a drop-in replacement, not a rewrite.
export async function generateGoalMilestones(input: {
  title: string;
  type: string;
}): Promise<MilestoneSuggestion[]> {
  return MOCK_MILESTONES[input.type] ?? MOCK_MILESTONES.personal;
}
