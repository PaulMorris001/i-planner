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
}
