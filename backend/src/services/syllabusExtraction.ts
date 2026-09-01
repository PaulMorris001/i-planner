import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Base model, not the mini tier — this needs real document comprehension
// (reading a PDF's layout/tables), not just short generation from a prompt.
const OPENAI_MODEL = 'gpt-5.4';

// Extension -> MIME type for every file type the upload picker offers (see
// SyllabusUploadModal.tsx's matching list). The Responses API branches on
// this: PDFs get real page-image + text extraction via `input_file`, other
// documents get text-only via the same `input_file` type, and photos need
// the separate `input_image` content type entirely (see extractSyllabus).
export const SYLLABUS_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// Filename -> MIME type, or null if its extension isn't one of the supported
// types above (the controller turns null into a clean 400).
export function mimeTypeForFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? SYLLABUS_MIME_BY_EXT[ext] ?? null : null;
}

export interface SyllabusDeadline {
  title: string;
  date: string; // ISO 8601, YYYY-MM-DD
}

export interface SyllabusExtractionResult {
  courseName: string;
  deadlines: SyllabusDeadline[];
  // Course topics/units/chapters in the order covered. Unlike deadlines these have
  // no real date, so the client shows them as editable rows the user can date
  // themselves — guarantees something usable even with no dated deadlines at all.
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

// Sent directly to OpenAI as a file/image input (base64) — no separate OCR/parsing
// step. Throws on failure, unlike goalMilestones/examTopics — no sensible canned
// fallback for a real document's content; the controller maps it to a clean error.
export async function extractSyllabus(input: {
  fileBase64: string;
  filename: string;
  mimeType: string;
}): Promise<SyllabusExtractionResult> {
  const today = new Date().toISOString().slice(0, 10);

  // Photos (a snapped picture of a printed/whiteboard syllabus) go through the
  // Responses API's separate vision content type — `input_file`'s `file_data`
  // is for documents (PDF/DOCX/PPTX get either real page-image+text or
  // text-only extraction depending on type), not a plain image.
  const fileContentPart = input.mimeType.startsWith('image/')
    ? {
        type: 'input_image' as const,
        image_url: `data:${input.mimeType};base64,${input.fileBase64}`,
        // High detail — a syllabus photo needs to be read for small print, not
        // just recognized at a glance.
        detail: 'high' as const,
      }
    : { type: 'input_file' as const, filename: input.filename, file_data: `data:${input.mimeType};base64,${input.fileBase64}` };

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
          fileContentPart,
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
