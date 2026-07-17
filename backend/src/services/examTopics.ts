import OpenAI from 'openai';
import { env } from '../config/env';

export interface ExamTopicSuggestion {
  title: string;
  week: number;
}

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Same tier as goalMilestones.ts — short structured JSON output, no need for a
// larger reasoning model.
const OPENAI_MODEL = 'gpt-5.4-mini';

const MIN_TOPICS = 1;
// Caps how large the generated schema/output gets for a very long multi-year
// weeksRemaining — one topic per week beyond this just isn't a meaningful ask.
const MAX_TOPICS = 26;

function fallbackTopics(count: number): ExamTopicSuggestion[] {
  return Array.from({ length: count }, (_, i) => ({
    title: i === count - 1 ? 'Final review and practice test' : `Week ${i + 1} study topics`,
    week: i + 1,
  }));
}

function buildSchema(count: number) {
  return {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short, concrete study topic title (under 60 characters).',
            },
            week: {
              type: 'integer',
              description: `Which study week this topic belongs to, from 1 to ${count}.`,
            },
          },
          required: ['title', 'week'],
          additionalProperties: false,
        },
      },
    },
    required: ['topics'],
    additionalProperties: false,
  };
}

// Real OpenAI call — one topic per week of the study plan (weeksRemaining,
// clamped), ordered foundational-to-advanced with the final week(s) reserved
// for review. Falls back to generic per-week placeholders on API failure so
// exam creation never hard-blocks on an AI outage.
export async function generateExamTopics(input: {
  name: string;
  subject: string;
  hoursPerWeek: number;
  weeksRemaining: number;
}): Promise<ExamTopicSuggestion[]> {
  const count = Math.max(MIN_TOPICS, Math.min(Math.round(input.weeksRemaining) || MIN_TOPICS, MAX_TOPICS));

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input:
        `Generate a week-by-week study topic breakdown for this exam, exactly ${count} topics, one per week.\n\n` +
        `Exam name: "${input.name}"\n` +
        `Subject: "${input.subject}"\n` +
        `Available study time: ${input.hoursPerWeek} hours/week over ${count} weeks\n\n` +
        `Order topics from foundational to advanced, building toward exam readiness. The final ` +
        `1-2 weeks should be review and practice-testing rather than new material.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'exam_topics',
          schema: buildSchema(count),
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as { topics?: ExamTopicSuggestion[] };
    if (parsed.topics?.length) return parsed.topics;
    console.error('[examTopics] OpenAI response had no usable topics, using fallback');
  } catch (err) {
    console.error('[examTopics] OpenAI API call failed, using fallback', err);
  }

  return fallbackTopics(count);
}
