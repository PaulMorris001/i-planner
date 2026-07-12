// Placeholder data only — real syllabus upload & AI parsing isn't built yet.
// Lets the "My Syllabi" card/page demonstrate the 3-max + "View all" pattern
// ahead of the real feature.
export interface DummySyllabus {
  id: string;
  fileName: string;
  courseName: string;
  addedDate: string;
}

export const DUMMY_SYLLABI: DummySyllabus[] = [
  { id: 'sy1', fileName: 'corporate-finance-syllabus.pdf', courseName: 'Corporate Finance', addedDate: 'Sep 3' },
  { id: 'sy2', fileName: 'marketing-management-syllabus.pdf', courseName: 'Marketing Management', addedDate: 'Sep 5' },
  { id: 'sy3', fileName: 'managerial-economics-syllabus.pdf', courseName: 'Managerial Economics', addedDate: 'Sep 6' },
  { id: 'sy4', fileName: 'financial-accounting-syllabus.pdf', courseName: 'Financial Accounting', addedDate: 'Sep 8' },
  { id: 'sy5', fileName: 'org-behavior-syllabus.pdf', courseName: 'Organizational Behavior', addedDate: 'Sep 9' },
];
