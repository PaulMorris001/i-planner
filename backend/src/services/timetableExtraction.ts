import OpenAI from 'openai';
import { env } from '../config/env';
import { fileContentPartFor } from './aiFileInput';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Same model choice as syllabusExtraction.ts and for the same reason — real
// document/layout comprehension (reading a grid table or dense prose), not
// just short generation from a prompt.
const OPENAI_MODEL = 'gpt-5.4';

export interface TimetableMeeting {
  courseName: string;
  // Monday=0..Sunday=6 — every weekday this exact meeting occurs on.
  days: number[];
  startTime: string; // 24-hour "HH:MM"
  endTime: string | null;
  professor: string | null;
  venue: string | null;
}

export interface TimetableExtractionResult {
  meetings: TimetableMeeting[];
  // Term/semester date range, YYYY-MM-DD, if printed anywhere on the document
  // (a cover page, header, etc.) — null when not stated. Lets the client seed
  // every extracted class's recurrence window (ClassItem.startDate/endDate)
  // without asking the user, when the document already says so; the client
  // prompts for these itself when either comes back null.
  semesterStartDate: string | null;
  semesterEndDate: string | null;
}

// A flat list of meeting *blocks*, not "courses with a nested times array" —
// deliberately, so a course meeting at different times on different days
// (e.g. Mon 9am + Wed 2pm) comes back as two entries sharing the same
// courseName rather than one entry that can't represent two times at once.
// This maps 1:1 onto one ClassItem per entry (days -> dayIdxs, startTime ->
// time) with zero client-side grouping/flattening needed — see
// TimetableUploadModal.tsx.
const TIMETABLE_SCHEMA = {
  type: 'object',
  properties: {
    meetings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          courseName: {
            type: 'string',
            description: 'The course/class name or code as shown (e.g. "CS101" or "Corporate Finance").',
          },
          days: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            description: 'Every weekday this exact meeting occurs on, Monday=0..Sunday=6.',
          },
          startTime: {
            type: 'string',
            description: 'Meeting start time, 24-hour HH:MM.',
          },
          endTime: {
            type: ['string', 'null'],
            description: 'Meeting end time, 24-hour HH:MM, or null if not stated.',
          },
          professor: {
            type: ['string', 'null'],
            description: 'Instructor/professor name if stated, else null.',
          },
          venue: {
            type: ['string', 'null'],
            description: 'Room/building/venue if stated, else null.',
          },
        },
        required: ['courseName', 'days', 'startTime', 'endTime', 'professor', 'venue'],
        additionalProperties: false,
      },
    },
    semesterStartDate: {
      type: ['string', 'null'],
      description: 'Term/semester start date in YYYY-MM-DD, if printed anywhere on the document, else null.',
    },
    semesterEndDate: {
      type: ['string', 'null'],
      description: 'Term/semester end date in YYYY-MM-DD, if printed anywhere on the document, else null.',
    },
  },
  required: ['meetings', 'semesterStartDate', 'semesterEndDate'],
  additionalProperties: false,
};

// Sent directly to OpenAI as a file/image input (base64) — no separate OCR/
// parsing step, same as extractSyllabus. Throws on failure — no sensible
// canned fallback for a real document's content; the controller maps it to
// a clean error.
export async function extractTimetable(input: {
  fileBase64: string;
  filename: string;
  mimeType: string;
}): Promise<TimetableExtractionResult> {
  const today = new Date().toISOString().slice(0, 10);
  const fileContentPart = fileContentPartFor(input.mimeType, input.filename, input.fileBase64);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              `Today's date is ${today}. Read this class timetable/schedule — it may be a grid/table ` +
              '(rows or columns per weekday, cells listing classes), plain prose describing when courses ' +
              'meet, or a mix (e.g. a printed grid with handwritten notes). Extract every distinct weekly ' +
              'class meeting as one entry in "meetings":\n' +
              '1. courseName — the course/class name or code as shown.\n' +
              '2. days — every weekday this specific meeting occurs on (0=Monday..6=Sunday).\n' +
              '3. startTime (and endTime if given), 24-hour HH:MM.\n' +
              '4. professor/instructor and venue/room if stated, else null.\n\n' +
              'CRITICAL: if the same course meets at different times on different days (e.g. "CS101 Mon ' +
              '9-10am, Wed 2-3pm"), that is TWO meetings, not one — emit a separate entry per distinct ' +
              'time, and only put multiple days in one entry\'s "days" array when they share the exact ' +
              'same start (and end) time. Never force different times onto one entry, and never drop a ' +
              "meeting because it doesn't match the pattern of the course's other days. Use the identical " +
              'courseName string across every entry for the same course so they can be recognized as the ' +
              'same class.\n\n' +
              'Also look anywhere on the document (a cover page, header, footer, or mentioned in passing) ' +
              'for the term/semester\'s own date range — e.g. "Fall 2026", "Spring Semester: Jan 12 - May ' +
              '1", an academic calendar excerpt, etc. Report it as semesterStartDate/semesterEndDate in ' +
              "YYYY-MM-DD, inferring the year from today's date if only a season/term name is given " +
              '(e.g. "Fall 2026" implies roughly September-December 2026 — use your best judgment for the ' +
              'exact start/end days if an exact range isn\'t printed). If no such range is stated or ' +
              'reasonably inferable anywhere on the document, use null for both rather than guessing — the ' +
              "app will ask the user directly in that case.\n\n" +
              'This may be a table or unstructured prose — read either correctly; do not assume a grid ' +
              'layout. Only extract the regular weekly schedule — skip anything that reads as a one-off ' +
              'dated event (e.g. "Final exam Dec 3rd") rather than a recurring weekly meeting.',
          },
          fileContentPart,
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'timetable_extraction',
        schema: TIMETABLE_SCHEMA,
        strict: true,
      },
    },
    max_output_tokens: 4096,
  });

  return JSON.parse(response.output_text) as TimetableExtractionResult;
}
