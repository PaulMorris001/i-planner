import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Same structured-output pattern as goalMilestones.ts/examTopics.ts, but this
// task needs real document comprehension (reading an actual PDF's layout and
// tables), not just short generation from a prompt — using the base model
// rather than the mini tier for better accuracy on real syllabus documents.
const OPENAI_MODEL = 'gpt-5.4';

export interface SyllabusDeadline {
  title: string;
  date: string; // ISO 8601, YYYY-MM-DD
}

export interface SyllabusExtractionResult {
  courseName: string;
  deadlines: SyllabusDeadline[];
  // Course topics/units/chapters, in the order they're covered — pulled from
  // the syllabus's schedule or table of contents. Unlike deadlines, these
  // never have a real date attached (the syllabus doesn't give one), so the
  // client shows them as editable rows the user can attach a date to
  // themselves. Guarantees the extraction returns *something* usable even for
  // a syllabus with no explicit dated deadlines at all.
  subtopics: string[];
}

const SYLLABUS_SCHEMA = {
  type: 'object',
  properties: {
    courseName: {
      type: 'string',
      description: 'The course/class name as it appears on the syllabus (e.g. "Corporate Finance").',
    },
    deadlines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short description of the deadline (e.g. "Problem Set 3 due", "Midterm exam").',
          },
          date: {
            type: 'string',
            description: 'The deadline date in YYYY-MM-DD format.',
          },
        },
        required: ['title', 'date'],
        additionalProperties: false,
      },
    },
    subtopics: {
      type: 'array',
      items: {
        type: 'string',
        description: 'A single topic/unit/chapter title (e.g. "Thermodynamics", "Week 3: Acids and Bases").',
      },
      description:
        'The course\'s topics/units in the order they\'re covered, pulled from the schedule or table of ' +
        'contents — include these regardless of whether they have a date attached, unlike deadlines.',
    },
  },
  required: ['courseName', 'deadlines', 'subtopics'],
  additionalProperties: false,
};

// Extracts the course name, every dated deadline, and the course's topic
// outline from a syllabus PDF. Sent directly to OpenAI as a file input
// (base64) — no separate OCR/parsing step. Throws on failure (unlike
// goalMilestones/examTopics, there's no sensible canned fallback for a real
// document's real content) — the controller maps that to a clean
// user-facing error.
export async function extractSyllabus(input: {
  fileBase64: string;
  filename: string;
}): Promise<SyllabusExtractionResult> {
  const today = new Date().toISOString().slice(0, 10);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              `Today's date is ${today}. Read this course syllabus and extract:\n` +
              `1. The course/class name.\n` +
              '2. Every dated deadline mentioned — assignments, problem sets, papers, projects, ' +
              'quizzes, exams, presentations, readings with a specific due date, etc. Give each a short ' +
              'title and its date in YYYY-MM-DD format. If a date has no year given, infer the most ' +
              "sensible academic year using today's date as reference. Skip anything without an actual " +
              'date here — that goes in the topic list below instead.\n' +
              '3. The course\'s full topic/unit outline — every topic, chapter, or weekly subject listed ' +
              'in the syllabus\'s schedule or table of contents, in the order they\'re covered, regardless ' +
              "of whether a specific date is given for it. A syllabus with no dated deadlines at all " +
              'should still produce a topic list here if it has any kind of schedule or outline section — ' +
              'this is the one part of the extraction that should almost never come back empty.\n\n' +
              'If no course name is stated explicitly, use the most likely course title based on the content.',
          },
          {
            type: 'input_file',
            filename: input.filename,
            file_data: `data:application/pdf;base64,${input.fileBase64}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'syllabus_extraction',
        schema: SYLLABUS_SCHEMA,
        strict: true,
      },
    },
    max_output_tokens: 4096,
  });

  return JSON.parse(response.output_text) as SyllabusExtractionResult;
}
