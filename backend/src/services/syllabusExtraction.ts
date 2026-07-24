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
  },
  required: ['courseName', 'deadlines'],
  additionalProperties: false,
};

// Extracts the course name and every dated deadline from a syllabus PDF. Sent
// directly to OpenAI as a file input (base64) — no separate OCR/parsing step.
// Throws on failure (unlike goalMilestones/examTopics, there's no sensible
// canned fallback for a real document's real content) — the controller maps
// that to a clean user-facing error.
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
              'quizzes, exams, presentations, readings with a specific due date, etc.\n\n' +
              'For each deadline, give a short title and its date in YYYY-MM-DD format. If a date has ' +
              'no year given, infer the most sensible academic year using today\'s date as reference. ' +
              'Skip anything without an actual date (e.g. "weekly readings" with no specific date). ' +
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
