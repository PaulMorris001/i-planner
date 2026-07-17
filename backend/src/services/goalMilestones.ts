import OpenAI from 'openai';
import { env } from '../config/env';

export interface MilestoneSuggestion {
  title: string;
  dueLabel: string;
}

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Cost-effective tier appropriate for short structured JSON output — confirmed
// against the live /v1/models list rather than assumed.
const OPENAI_MODEL = 'gpt-5.4-mini';

// Used when the API call fails or returns something unusable — goal creation
// shouldn't be blocked by an AI outage.
const FALLBACK_MILESTONES: Record<string, MilestoneSuggestion[]> = {
  study: [
    { title: 'Outline the syllabus and key topics', dueLabel: 'This week' },
    { title: 'Complete a first practice test', dueLabel: 'This month' },
    { title: 'Review weak areas', dueLabel: 'Mid-way' },
    { title: 'Take a final mock exam', dueLabel: 'Final stretch' },
  ],
  career: [
    { title: 'Map the skills this role needs', dueLabel: 'This month' },
    { title: 'Find a mentor already in the field', dueLabel: 'Next 2 months' },
    { title: 'Lead a visible cross-team project', dueLabel: 'Mid-way' },
    { title: 'Interview / apply for the role', dueLabel: 'Final stretch' },
  ],
  personal: [
    { title: 'Define what success looks like', dueLabel: 'This week' },
    { title: 'Build a simple daily habit toward it', dueLabel: 'This month' },
    { title: 'Check in on progress', dueLabel: 'Mid-way' },
    { title: 'Celebrate small wins along the way', dueLabel: 'Final stretch' },
  ],
  habit: [
    { title: 'Start with a small, repeatable version', dueLabel: 'This week' },
    { title: 'Track it daily for two weeks', dueLabel: 'This month' },
    { title: 'Push through the mid-point dip', dueLabel: 'Mid-way' },
    { title: 'Make it automatic', dueLabel: 'Final stretch' },
  ],
};

const MILESTONES_SCHEMA = {
  type: 'object',
  properties: {
    milestones: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short, concrete, actionable milestone title (under 60 characters).',
          },
          dueLabel: {
            type: 'string',
            description: 'A relative timing label, e.g. "This week", "This month", "Mid-way", "Final stretch".',
          },
        },
        required: ['title', 'dueLabel'],
        additionalProperties: false,
      },
    },
  },
  required: ['milestones'],
  additionalProperties: false,
};

// Real OpenAI call, replacing the old hardcoded stub. Uses Structured Outputs
// (json_schema, strict mode) for reliable JSON rather than parsing freeform text.
export async function generateGoalMilestones(input: {
  title: string;
  type: string;
}): Promise<MilestoneSuggestion[]> {
  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input:
        `Generate exactly 4 sequential milestones to help someone achieve this goal.\n\n` +
        `Goal title: "${input.title}"\n` +
        `Goal type: ${input.type}\n\n` +
        `The milestones should be concrete, actionable steps in logical order from first ` +
        `to last, appropriate for a "${input.type}" goal.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'milestones',
          schema: MILESTONES_SCHEMA,
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as { milestones?: MilestoneSuggestion[] };
    if (parsed.milestones?.length) return parsed.milestones;
    console.error('[goalMilestones] OpenAI response had no usable milestones, using fallback');
  } catch (err) {
    console.error('[goalMilestones] OpenAI API call failed, using fallback', err);
  }

  return FALLBACK_MILESTONES[input.type] ?? FALLBACK_MILESTONES.personal;
}
