import type {
  CoachMessage,
  CoachModeId,
  CoachSendResult,
} from "@/types/coach.types";
import { authedRequest } from "./authedRequest";

export const coachService = {
  list: (mode: CoachModeId) => authedRequest<CoachMessage[]>(`/coach/${mode}`),

  send: (
    mode: CoachModeId,
    content: string,
    attachments: { filename: string; fileBase64: string }[] = [],
    onUploadProgress?: (fraction: number) => void,
  ) =>
    authedRequest<CoachSendResult>(`/coach/${mode}`, {
      method: "POST",
      body: attachments.length ? { content, attachments } : { content },
      // Uploading and reading a document takes longer than a plain reply.
      ...(attachments.length ? { timeoutMs: 120_000, onUploadProgress } : {}),
    }),
};
