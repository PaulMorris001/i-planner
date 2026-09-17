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

// A single dated item — an exam, a one-off session, anything tied to one
// specific calendar date rather than a weekly-recurring slot. A document
// like an exam timetable (every row is "Mon 22nd June", "Wed 24th June", ...)
// is entirely made of these and has no `meetings` at all — the two arrays
// are independent, not alternatives; a single document can produce both, one
// of either, or neither.
export interface TimetableOneOffEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // 24-hour "HH:MM", null if no time is stated
  endTime: string | null;
  venue: string | null;
}

export interface TimetableExtractionResult {
  meetings: TimetableMeeting[];
  oneOffEvents: TimetableOneOffEvent[];
  // Term/semester date range, YYYY-MM-DD, if printed anywhere on the document
  // (a cover page, header, etc.) — null when not stated. Lets the client seed
  // every extracted class's recurrence window (ClassItem.startDate/endDate)
  // without asking the user, when the document already says so; the client
  // prompts for these itself when either comes back null. Only relevant to
  // `meetings` — oneOffEvents already carry their own explicit date.
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
    oneOffEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'A short, clear label — e.g. "THA 322: Intermediate Playwriting exam".',
          },
          date: {
            type: 'string',
            description: 'The event date in YYYY-MM-DD format.',
          },
          startTime: {
            type: ['string', 'null'],
            description: '24-hour HH:MM, or null if no time is stated.',
          },
          endTime: {
            type: ['string', 'null'],
            description: '24-hour HH:MM, or null if not stated.',
          },
          venue: {
            type: ['string', 'null'],
            description: 'Room/building/venue if stated, else null.',
          },
        },
        required: ['title', 'date', 'startTime', 'endTime', 'venue'],
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
  required: ['meetings', 'oneOffEvents', 'semesterStartDate', 'semesterEndDate'],
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
              `Today's date is ${today}. Read this timetable/schedule document — it may be a grid/table ` +
              '(rows or columns per weekday, cells listing classes), a dated list (e.g. an exam timetable ' +
              'with one row per calendar date), plain prose, or a mix. It contains TWO different kinds of ' +
              'entries, and you must sort every item you find into the right one — do not skip either kind:\n\n' +
              '"meetings" — a RECURRING WEEKLY class slot, the same weekday(s) and time every week for the ' +
              'whole term (e.g. "CS101, Mon/Wed/Fri 9-10am"). For each:\n' +
              '1. courseName — the course/class name or code as shown.\n' +
              '2. days — every weekday this specific meeting occurs on (0=Monday..6=Sunday).\n' +
              '3. startTime (and endTime if given), 24-hour HH:MM.\n' +
              '4. professor/instructor and venue/room if stated, else null.\n' +
              'CRITICAL: if the same course meets at different times on different days (e.g. "CS101 Mon ' +
              '9-10am, Wed 2-3pm"), that is TWO meetings, not one — emit a separate entry per distinct ' +
              'time, and only put multiple days in one entry\'s "days" array when they share the exact ' +
              'same start (and end) time. Use the identical courseName string across every entry for the ' +
              'same course so they can be recognized as the same class.\n\n' +
              '"oneOffEvents" — anything tied to ONE SPECIFIC CALENDAR DATE instead of a weekly-repeating ' +
              'slot: an exam timetable (each row/date is its own entry — this is the common case; an exam ' +
              'schedule has NO recurring meetings at all, everything in it belongs here), a single ' +
              'presentation/deadline/one-off session, orientation day, etc. For each:\n' +
              '1. title — short and clear (course code + name + what it is, e.g. "THA 322: Intermediate ' +
              'Playwriting exam").\n' +
              '2. date, YYYY-MM-DD — infer the year from today\'s date if only a day/month is given (a ' +
              'label like "1st week, Mon 22nd June" still has one real calendar date; work it out from ' +
              "the document's own context, e.g. other dated rows or a stated term).\n" +
              '3. startTime/endTime if given (24-hour HH:MM), else null — many exam timetables give a ' +
              'session name like "Morning 8:00am-11:00am" instead of a per-row time; use that session\'s ' +
              'own time range for every entry under it.\n' +
              '4. venue/room if stated, else null.\n\n' +
              'Never force a one-off dated item into "meetings", and never drop a recurring weekly slot ' +
              'into "oneOffEvents" just because a specific date happened to be mentioned alongside it — sort ' +
              'by whether it actually repeats weekly or not, not by whether a date is present.\n\n' +
              'Also look anywhere on the document (a cover page, header, footer, or mentioned in passing) ' +
              'for the term/semester\'s own date range — e.g. "Fall 2026", "Spring Semester: Jan 12 - May ' +
              '1", an academic calendar excerpt, etc. — and report it as semesterStartDate/semesterEndDate ' +
              "in YYYY-MM-DD, inferring the year from today's date if only a season/term name is given. " +
              'This only applies to "meetings" (a recurring class needs a window to repeat within); leave ' +
              'both null if nothing is stated or inferable, or if the document has no meetings at all.\n\n' +
              'This may be a table or unstructured prose — read either correctly; do not assume a grid layout.',
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
