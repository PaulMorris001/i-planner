export interface TimetableMeeting {
  courseName: string;
  days: number[];
  startTime: string; // 24-hour "HH:MM"
  endTime: string | null;
  professor: string | null;
  venue: string | null;
}

export interface TimetableOneOffEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // 24-hour "HH:MM"
  endTime: string | null;
  venue: string | null;
}

export interface TimetableExtractionResult {
  meetings: TimetableMeeting[];
  oneOffEvents: TimetableOneOffEvent[];
  semesterStartDate: string | null;
  semesterEndDate: string | null;
}
