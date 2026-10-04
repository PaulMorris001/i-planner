import OpenAI, { toFile } from 'openai';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { mimeTypeForFilename } from './aiFileInput';
import type { CoachAttachment } from '../models/CoachMessage';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Limits for files attached to an AI Coach message. Sized to stay well inside
// express.json's 30mb body limit (app.ts) once base64 inflates them by ~33%.
export const MAX_COACH_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
// Plain-text files are read directly instead of going through OpenAI file
// storage; this caps how much of one rides along in the prompt.
const MAX_TEXT_CHARS = 60_000;
// OpenAI deletes uploaded attachments on its own after this long, so nothing
// needs cleaning up when messages or accounts are deleted.
export const ATTACHMENT_TTL_SECONDS = 30 * 24 * 60 * 60;

const TEXT_MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
};

export interface IncomingAttachment {
  filename: string;
  fileBase64: string;
}

function decodedSize(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

// Validates the request body's attachments up front, before any usage is
// consumed or anything is uploaded. Returns [] when there are none.
export function parseIncomingAttachments(raw: unknown): IncomingAttachment[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, 'attachments must be an array.', 'general');
  if (raw.length > MAX_COACH_ATTACHMENTS) {
    throw new ApiError(400, `You can attach up to ${MAX_COACH_ATTACHMENTS} files per message.`, 'general');
  }
  let total = 0;
  return raw.map((item) => {
    const filename = (item as IncomingAttachment)?.filename;
    const fileBase64 = (item as IncomingAttachment)?.fileBase64;
    if (typeof filename !== 'string' || !filename.trim() || typeof fileBase64 !== 'string' || !fileBase64) {
      throw new ApiError(400, 'Each attachment needs a filename and file contents.', 'general');
    }
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (!mimeTypeForFilename(filename) && !TEXT_MIME_BY_EXT[ext]) {
      throw new ApiError(400, `"${filename}" isn't supported. Attach a PDF, Word, PowerPoint, text file, or a JPG/PNG photo.`, 'general');
    }
    const size = decodedSize(fileBase64);
    if (size > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(400, `"${filename}" is too large. Files can be up to 10 MB.`, 'general');
    }
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new ApiError(400, 'Attachments can be up to 20 MB in total.', 'general');
    return { filename: filename.trim(), fileBase64 };
  });
}

// Stores one attachment: text files inline, everything else in OpenAI file
// storage (referenced by id on later turns, so follow-up questions about the
// same document still have it).
export async function storeCoachAttachment(input: IncomingAttachment): Promise<CoachAttachment> {
  const ext = input.filename.split('.').pop()?.toLowerCase() ?? '';
  const textMime = TEXT_MIME_BY_EXT[ext];
  if (textMime) {
    const text = Buffer.from(input.fileBase64, 'base64').toString('utf8').slice(0, MAX_TEXT_CHARS);
    return { filename: input.filename, mimeType: textMime, textContent: text };
  }

  const mimeType = mimeTypeForFilename(input.filename)!;
  const file = await openai.files.create({
    file: await toFile(Buffer.from(input.fileBase64, 'base64'), input.filename, { type: mimeType }),
    // Images are read through the vision input type, documents through file input.
    purpose: mimeType.startsWith('image/') ? 'vision' : 'user_data',
    expires_after: { anchor: 'created_at', seconds: ATTACHMENT_TTL_SECONDS },
  });
  return { filename: input.filename, mimeType, openaiFileId: file.id };
}

// The Responses API content parts for a message's attachments.
export function attachmentContentParts(attachments: CoachAttachment[]): OpenAI.Responses.ResponseInputContent[] {
  return attachments.flatMap((a): OpenAI.Responses.ResponseInputContent[] => {
    if (a.textContent !== undefined) {
      return [{ type: 'input_text' as const, text: `Attached file "${a.filename}":\n${a.textContent}` }];
    }
    if (!a.openaiFileId) return [];
    return a.mimeType.startsWith('image/')
      ? [{ type: 'input_image' as const, file_id: a.openaiFileId, detail: 'high' as const }]
      : [{ type: 'input_file' as const, file_id: a.openaiFileId }];
  });
}
