export type CoachModeId = "study" | "plan" | "goal";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  // Names of files attached to a user message.
  attachments?: { filename: string }[];
  createdAt: string;
}

export interface CoachSendResult extends CoachMessage {
  createdTaskIds?: string[];
}
