import { Schema, model, Document } from 'mongoose';

// Bookkeeping only — the PDF itself is never stored, just sent to OpenAI and
// discarded. classId links to the ClassItem in Plan.data.classes it created.
export interface SyllabusDocument extends Document {
  firebaseUid: string;
  fileName: string;
  courseName: string;
  classId?: string;
  createdAt: Date;
}

const syllabusSchema = new Schema<SyllabusDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    courseName: { type: String, required: true },
    classId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function toPublicSyllabus(doc: SyllabusDocument) {
  return {
    id: doc.id as string,
    fileName: doc.fileName,
    courseName: doc.courseName,
    classId: doc.classId,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const Syllabus = model<SyllabusDocument>('Syllabus', syllabusSchema);
