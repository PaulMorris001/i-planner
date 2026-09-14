export interface TimetableMeeting {
  courseName: string;
  days: number[];
  startTime: string; // 24-hour "HH:MM"
  endTime: string | null;
  professor: string | null;
  venue: string | null;
}

export interface TimetableExtractionResult {
  meetings: TimetableMeeting[];
  // Term/semester date range (YYYY-MM-DD), if the document stated one —
  // null means the app must ask the user for it. See
  // backend/src/services/timetableExtraction.ts.
  semesterStartDate: string | null;
  semesterEndDate: string | null;
}
