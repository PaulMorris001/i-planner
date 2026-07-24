import { createTaskDoc } from './taskCreation';

// Only offered in "Plan My Day" mode (coach.controller.ts) — the one mode
// that's actually about scheduling, so the model isn't tempted to create
// tasks out of a casual Study Buddy or Goal Coach conversation.
export const CREATE_TASK_TOOL = {
  type: 'function',
  name: 'create_task',
  description:
    'Create one or more tasks in the user\'s planner. Call this whenever the user asks you to add, ' +
    'create, remind them about, or schedule something — do not just describe what you would add.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short, clear task title.' },
            category: {
              type: 'string',
              enum: ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'],
              description: 'Best-fit category — infer from context if the user did not say one.',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Infer urgency from context; default to medium if unclear.',
            },
            dueDate: {
              type: ['string', 'null'],
              description: 'ISO date YYYY-MM-DD if a specific date was given or implied, else null.',
            },
            time: {
              type: ['string', 'null'],
              description: 'A time like "3:00 PM" if a specific time was given, else null.',
            },
            notes: {
              type: ['string', 'null'],
              description: 'Any extra detail worth keeping, else null.',
            },
          },
          required: ['title', 'category', 'priority', 'dueDate', 'time', 'notes'],
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  },
} as const;

const VALID_CATEGORIES = ['academic', 'career', 'personal', 'financial', 'exam', 'habit', 'other'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const MAX_TASKS_PER_MESSAGE = 10;

function weekdayIndexMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// Mirrors utils/time.ts's parseTimeToMinutes / googleCalendarSync.ts's
// parseTime — "no time" falls back to 23 to match NewTaskModal's convention
// (unscheduled tasks sort after time-scheduled ones within the same priority).
function parseTimeToHour(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 23;
  let hour = parseInt(match[1], 10) % 12;
  if (match[3]?.toUpperCase() === 'PM') hour += 12;
  return hour;
}

interface RawTaskDraft {
  title?: unknown;
  category?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  time?: unknown;
  notes?: unknown;
}

// Validates and creates each task the model asked for, then summarizes the
// outcome as plain text — fed back to the model (coachChat.ts's
// continueAfterToolCall) so it can confirm naturally, including any that
// were skipped, rather than the caller silently swallowing partial failures.
export async function createTasksFromDrafts(
  firebaseUid: string,
  rawArguments: string
): Promise<{ createdTaskIds: string[]; toolResultText: string }> {
  let drafts: RawTaskDraft[] = [];
  try {
    const parsed = JSON.parse(rawArguments) as { tasks?: RawTaskDraft[] };
    drafts = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, MAX_TASKS_PER_MESSAGE) : [];
  } catch (err) {
    console.error('[coachTools] failed to parse create_task arguments', err);
    return { createdTaskIds: [], toolResultText: 'The task details were malformed and nothing was created.' };
  }

  const createdTaskIds: string[] = [];
  const created: string[] = [];
  const skipped: string[] = [];

  for (const raw of drafts) {
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
      skipped.push('(untitled)');
      continue;
    }
    const category = typeof raw.category === 'string' && VALID_CATEGORIES.includes(raw.category) ? raw.category : 'other';
    const priority = typeof raw.priority === 'string' && VALID_PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
    const time = typeof raw.time === 'string' ? raw.time.trim() : '';

    let dueDateIso = '';
    let day = weekdayIndexMonday(new Date());
    if (typeof raw.dueDate === 'string' && raw.dueDate) {
      const parsed = new Date(raw.dueDate);
      if (!Number.isNaN(parsed.getTime())) {
        dueDateIso = parsed.toISOString();
        day = weekdayIndexMonday(parsed);
      }
    }

    try {
      const task = await createTaskDoc(firebaseUid, {
        title,
        category,
        priority,
        day,
        hour: parseTimeToHour(time),
        time,
        dueDate: dueDateIso,
        recurring: false,
        notes: typeof raw.notes === 'string' ? raw.notes : '',
      });
      createdTaskIds.push(task.id);
      created.push(title);
    } catch (err) {
      console.error('[coachTools] failed to create task from AI draft', err);
      skipped.push(title);
    }
  }

  const parts: string[] = [];
  if (created.length) parts.push(`Created: ${created.join(', ')}.`);
  if (skipped.length) parts.push(`Could not create: ${skipped.join(', ')}.`);

  return {
    createdTaskIds,
    toolResultText: parts.length ? parts.join(' ') : 'No tasks were created.',
  };
}
