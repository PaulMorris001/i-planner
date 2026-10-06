import { Schema, model, Document } from 'mongoose';

export type StudyRunStatus = 'running' | 'paused' | 'ended';

// One use of a study session: Start ... (Pause/Resume)* ... Stop. The time is kept
// by the server, from its own clock, so it can't be faked from the phone. Only
// time spent running counts: while paused, nothing is added.
export interface StudyRunDocument extends Document {
  firebaseUid: string;
  sessionId: string;
  sessionName: string;
  startedAt: Date;
  endedAt?: Date;
  // Active (unpaused) milliseconds banked so far; does not include the current stretch.
  activeMs: number;
  // When the current running stretch began. Only set while running.
  lastResumeAt?: Date;
  status: StudyRunStatus;
  // True while the run is running or paused. A partial unique index allows only one
  // open run per account.
  open?: boolean;
  // When a scheduled session should stop by itself.
  autoStopAt?: Date;
  points: number;
}

const studyRunSchema = new Schema<StudyRunDocument>({
  firebaseUid: { type: String, required: true },
  sessionId: { type: String, required: true },
  sessionName: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  activeMs: { type: Number, default: 0, min: 0 },
  lastResumeAt: { type: Date },
  status: { type: String, enum: ['running', 'paused', 'ended'], required: true },
  open: { type: Boolean },
  autoStopAt: { type: Date },
  points: { type: Number, default: 0 },
});

studyRunSchema.index({ firebaseUid: 1, open: 1 }, { unique: true, partialFilterExpression: { open: true } });
studyRunSchema.index({ firebaseUid: 1, endedAt: 1 });

export function toPublicStudyRun(doc: StudyRunDocument) {
  return {
    id: doc.id as string,
    sessionId: doc.sessionId,
    sessionName: doc.sessionName,
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    activeMs: doc.activeMs,
    lastResumeAt: doc.lastResumeAt ? doc.lastResumeAt.toISOString() : null,
    autoStopAt: doc.autoStopAt ? doc.autoStopAt.toISOString() : null,
  };
}

export const StudyRun = model<StudyRunDocument>('StudyRun', studyRunSchema);
