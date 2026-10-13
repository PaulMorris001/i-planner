import OpenAI, { toFile } from 'openai';
import ExcelJS from 'exceljs';
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
// Plain-text and spreadsheet files are read directly instead of going through OpenAI file
// storage; this caps how much of one rides along in the prompt.
const MAX_TEXT_CHARS = 60_000;
// OpenAI deletes uploaded attachments on its own after this long, so nothing
// needs cleaning up when messages or accounts are deleted.
export const ATTACHMENT_TTL_SECONDS = 30 * 24 * 60 * 60;

const TEXT_MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
};
// Excel workbooks are turned into text here (a markdown table per sheet), so the table's rows and
// columns reach the model exactly, whatever the document format does with spreadsheets.
const SPREADSHEET_EXTS = new Set(['xlsx']);
// Picture formats the model can read. The phone's picker sometimes labels a file with the wrong
// extension, so the real format is read from the file's first bytes (see sniffImageFormat).
const IMAGE_MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
type ReadableImageFormat = keyof typeof IMAGE_MIME_BY_FORMAT;
const IMAGE_EXT_BY_FORMAT: Record<ReadableImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
const EXTRA_IMAGE_EXTS = new Set(['webp', 'gif']);

const SUPPORTED_TYPES_HINT = 'a PDF, Word, PowerPoint, Excel (.xlsx), CSV or text file, or a JPG/PNG photo or screenshot';

// A stored attachment, plus (for a picture whose storing failed temporarily) its contents to send
// with this one message. The inline copy is never saved.
export type ReadyAttachment = CoachAttachment & { inlineDataUrl?: string };

export interface IncomingAttachment {
  filename: string;
  fileBase64: string;
}

function decodedSize(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
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
    const ext = extensionOf(filename);
    const supported =
      !!mimeTypeForFilename(filename) || !!TEXT_MIME_BY_EXT[ext] || SPREADSHEET_EXTS.has(ext) || EXTRA_IMAGE_EXTS.has(ext);
    if (!supported) {
      throw new ApiError(400, `"${filename}" isn't supported. Attach ${SUPPORTED_TYPES_HINT}.`, 'general');
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

// ---- Pictures --------------------------------------------------------------------------------

type ImageFormat = ReadableImageFormat | 'heic' | 'bmp' | 'tiff' | null;

// The real format of a picture, from its first bytes. A phone can hand over a JPEG named ".png"
// (or the reverse), and the vision service rejects a file whose content doesn't match its label.
export function sniffImageFormat(bytes: Buffer): ImageFormat {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 6 && bytes.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString('latin1') === 'BM') return 'bmp';
  if (bytes.length >= 4 && (bytes.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || bytes.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])))) return 'tiff';
  return null;
}

function withExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base || 'photo'}.${ext}`;
}

// ---- Spreadsheets ----------------------------------------------------------------------------

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if (typeof v.text === 'string') return v.text;
    if (typeof v.error === 'string') return v.error;
    return '';
  }
  return String(value);
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

// Every sheet as a markdown table (first row as the header), capped to what fits in a prompt.
export async function spreadsheetToText(bytes: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const parts: string[] = [];
  let used = 0;
  let truncated = false;

  for (const sheet of workbook.worksheets) {
    if (truncated) break;
    const width = Math.min(sheet.columnCount, 60);
    if (!width) continue;
    const lines: string[] = [`## Sheet: ${sheet.name}`];
    let rowIndex = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (truncated) return;
      const cells: string[] = [];
      for (let c = 1; c <= width; c++) cells.push(escapeCell(cellText(row.getCell(c).value)));
      if (cells.every((c) => !c)) return;
      lines.push(`| ${cells.join(' | ')} |`);
      if (rowIndex === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
      rowIndex++;
      used += lines[lines.length - 1].length + 1;
      if (used > MAX_TEXT_CHARS) truncated = true;
    });
    if (rowIndex) parts.push(lines.join('\n'));
  }

  if (!parts.length) return '(This workbook has no data in it.)';
  const text = parts.join('\n\n');
  return truncated ? `${text}\n\n(The rest of this workbook was cut off because it is very large.)` : text;
}

// ---- Storing ---------------------------------------------------------------------------------

// What went wrong with an upload, in words the person can act on.
function uploadFailure(err: unknown, filename: string, isImage: boolean): ApiError {
  const status = (err as { status?: number } | null)?.status;
  if (status === 400 || status === 415 || status === 422) {
    return new ApiError(
      400,
      isImage
        ? `"${filename}" couldn't be read as a picture. Try taking a screenshot of it, or attach it as a PDF.`
        : `"${filename}" couldn't be read. Try saving it as a PDF and attaching that instead.`,
      'general'
    );
  }
  if (status === 413) return new ApiError(400, `"${filename}" is too large for the reader. Try a smaller file.`, 'general');
  return new ApiError(502, "The file reader is busy right now. Please try again in a moment.", 'general');
}

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
}

// Stores one attachment: text and spreadsheets inline, everything else in OpenAI file
// storage (referenced by id on later turns, so follow-up questions about the
// same document still have it).
export async function storeCoachAttachment(input: IncomingAttachment): Promise<ReadyAttachment> {
  const ext = extensionOf(input.filename);
  const bytes = Buffer.from(input.fileBase64, 'base64');
  if (!bytes.length) throw new ApiError(400, `"${input.filename}" is empty.`, 'general');

  const textMime = TEXT_MIME_BY_EXT[ext];
  if (textMime) {
    // A byte-order mark would show up as a stray character in the first cell.
    const text = bytes.toString('utf8').replace(/^﻿/, '').slice(0, MAX_TEXT_CHARS);
    return { filename: input.filename, mimeType: textMime, textContent: text };
  }

  if (SPREADSHEET_EXTS.has(ext)) {
    try {
      return { filename: input.filename, mimeType: 'text/markdown', textContent: await spreadsheetToText(bytes) };
    } catch (err) {
      console.error('[coach] failed to read spreadsheet', err);
      throw new ApiError(400, `"${input.filename}" couldn't be opened as an Excel file. Try saving it as a CSV or PDF.`, 'general');
    }
  }

  let filename = input.filename;
  let mimeType = mimeTypeForFilename(filename) ?? 'application/octet-stream';
  const claimedImage = mimeType.startsWith('image/') || EXTRA_IMAGE_EXTS.has(ext);

  if (claimedImage) {
    const format = sniffImageFormat(bytes);
    if (format === 'heic' || format === 'bmp' || format === 'tiff') {
      throw new ApiError(
        400,
        `"${input.filename}" is a ${format === 'heic' ? 'HEIC' : format.toUpperCase()} picture, which can't be read. Take a screenshot of it, or choose it again from Photos.`,
        'general'
      );
    }
    if (format) {
      // Label the file by what it really is.
      mimeType = IMAGE_MIME_BY_FORMAT[format];
      filename = withExtension(filename, IMAGE_EXT_BY_FORMAT[format]);
    } else {
      mimeType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    }
  }
  const isImage = mimeType.startsWith('image/');

  const upload = async () =>
    openai.files.create({
      file: await toFile(bytes, filename, { type: mimeType }),
      // Images are read through the vision input type, documents through file input.
      purpose: isImage ? 'vision' : 'user_data',
      expires_after: { anchor: 'created_at', seconds: ATTACHMENT_TTL_SECONDS },
    });

  try {
    let file;
    try {
      file = await upload();
    } catch (err) {
      if (!isTransient(err)) throw err;
      // One more try: a brief network or service hiccup should not cost the person their message.
      file = await upload();
    }
    return { filename, mimeType, openaiFileId: file.id };
  } catch (err) {
    console.error('[coach] failed to store attachment', err);
    // A picture can still be read for this one message by sending it inline, even when storing
    // it for later turns failed. Only for temporary failures: a file the service rejected as
    // invalid would be rejected there too.
    if (isImage && isTransient(err)) {
      return { filename, mimeType, inlineDataUrl: `data:${mimeType};base64,${bytes.toString('base64')}` };
    }
    throw uploadFailure(err, filename, isImage);
  }
}

// The Responses API content parts for a message's attachments.
export function attachmentContentParts(
  attachments: ReadyAttachment[]
): OpenAI.Responses.ResponseInputContent[] {
  return attachments.flatMap((a): OpenAI.Responses.ResponseInputContent[] => {
    if (a.textContent !== undefined) {
      return [{ type: 'input_text' as const, text: `Attached file "${a.filename}":\n${a.textContent}` }];
    }
    if (a.inlineDataUrl) {
      return [
        { type: 'input_text' as const, text: `Attached picture "${a.filename}". If it contains a table, read every row and column carefully.` },
        { type: 'input_image' as const, image_url: a.inlineDataUrl, detail: 'high' as const },
      ];
    }
    if (!a.openaiFileId) return [];
    return a.mimeType.startsWith('image/')
      ? [
          { type: 'input_text' as const, text: `Attached picture "${a.filename}". If it contains a table, read every row and column carefully.` },
          { type: 'input_image' as const, file_id: a.openaiFileId, detail: 'high' as const },
        ]
      : [{ type: 'input_file' as const, file_id: a.openaiFileId }];
  });
}
