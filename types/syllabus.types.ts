export interface Syllabus {
  id: string;
  fileName: string;
  courseName: string;
  classId?: string;
  createdAt: string;
}

export interface SyllabusDeadline {
  title: string;
  date: string; // ISO 8601, YYYY-MM-DD
}

export interface SyllabusExtractionResult {
  courseName: string;
  deadlines: SyllabusDeadline[];
  // Course topics/units, in the order they're covered — extracted regardless
  // of whether a specific date is given for them, unlike deadlines. Lets the
  // review screen still offer something useful when a syllabus has no
  // explicit dated deadlines at all.
  subtopics: string[];
}
