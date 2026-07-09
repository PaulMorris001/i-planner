import { Document, Model } from 'mongoose';
import { ApiError } from './ApiError';

// Finds a document by id, scoped to the requesting user, or throws a 404.
// Treats a malformed id (bad ObjectId format) the same as "not found" rather
// than letting Mongoose's CastError bubble up as a 500.
export async function findOwnedOrThrow<T extends Document & { firebaseUid: string }>(
  model: Model<T>,
  id: string,
  firebaseUid: string
): Promise<T> {
  let doc: T | null = null;
  try {
    doc = await model.findOne({ _id: id, firebaseUid });
  } catch {
    doc = null;
  }
  if (!doc) throw new ApiError(404, 'Not found.', 'general');
  return doc;
}
