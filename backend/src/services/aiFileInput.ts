// Shared by every one-shot "send a document/photo to OpenAI for structured
// extraction" feature (syllabusExtraction.ts, timetableExtraction.ts, and
// whatever comes next) — the MIME-detection and Responses-API content-part
// branching are identical across all of them; only the schema/prompt differ
// per feature, which stays in each feature's own file.

// Extension -> MIME type for every file type the upload pickers offer (see
// SyllabusUploadModal.tsx / TimetableUploadModal.tsx's matching lists). The
// Responses API branches on this: PDFs/DOCX/PPTX get real page-image + text
// extraction via `input_file`, photos need the separate `input_image`
// content type entirely (see fileContentPartFor below).
export const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// Filename -> MIME type, or null if its extension isn't one of the supported
// types above (each controller turns null into a clean 400).
export function mimeTypeForFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? MIME_BY_EXT[ext] ?? null : null;
}

// The Responses API `input` content-part for one uploaded file, branched by
// MIME type. Photos (a snapped picture of a printed/whiteboard document) go
// through the separate vision content type — `input_file`'s `file_data` is
// for documents (PDF/DOCX/PPTX get either real page-image+text or text-only
// extraction depending on type), not a plain image.
export function fileContentPartFor(mimeType: string, filename: string, fileBase64: string) {
  return mimeType.startsWith('image/')
    ? {
        type: 'input_image' as const,
        image_url: `data:${mimeType};base64,${fileBase64}`,
        // High detail — a photographed document needs to be read for small
        // print/fine grid lines, not just recognized at a glance.
        detail: 'high' as const,
      }
    : { type: 'input_file' as const, filename, file_data: `data:${mimeType};base64,${fileBase64}` };
}
