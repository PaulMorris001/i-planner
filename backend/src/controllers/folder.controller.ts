import { Response } from 'express';
import { Folder, toPublicFolder } from '../models/Folder';
import { Note } from '../models/Note';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { FOLDER_NAME_MAX_LENGTH } from '../constants/noteLimits';

function requireValidName(name: unknown): string {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Folder name is required.', 'general');
  }
  const trimmed = name.trim();
  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) {
    throw new ApiError(400, `Folder name is too long (max ${FOLDER_NAME_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }
  return trimmed;
}

// Alphabetical, unlike notes' recency sort (Note.find().sort({updatedAt:-1}))
// — a small, human-curated list of folders reads better sorted by name than
// by whichever was touched most recently.
export async function listFolders(req: AuthedRequest, res: Response) {
  const folders = await Folder.find({ firebaseUid: req.userId }).sort({ name: 1 });
  res.json(folders.map(toPublicFolder));
}

export async function createFolder(req: AuthedRequest, res: Response) {
  const { name, parentId } = req.body ?? {};
  const trimmedName = requireValidName(name);
  // Same ownership check as a note's folderId — a folder can never be created
  // under another user's folder, or one that no longer exists.
  if (typeof parentId === 'string' && parentId) {
    await findOwnedOrThrow(Folder, parentId, req.userId!);
  }

  const folder = await Folder.create({
    firebaseUid: req.userId,
    name: trimmedName,
    ...(typeof parentId === 'string' && parentId ? { parentId } : {}),
  });
  res.status(201).json(toPublicFolder(folder));
}

export async function updateFolder(req: AuthedRequest, res: Response) {
  const folder = await findOwnedOrThrow(Folder, req.params.id, req.userId!);

  const { name } = req.body ?? {};
  if (name !== undefined) {
    folder.name = requireValidName(name);
  }

  await folder.save();
  res.json(toPublicFolder(folder));
}

// Unfiles every note in this folder, and promotes every direct subfolder up
// to this folder's own parent (or to root, if this was already a root
// folder), before deleting it — a folder is an organizational label, not a
// container that should be able to take a user's notes *or subfolders* down
// with it. Matches this app's general stance on destructive actions elsewhere
// (e.g. Timetable's endDate never deletes a class, Settings' disableReminders
// only cancels notifications, never data).
export async function deleteFolder(req: AuthedRequest, res: Response) {
  const folder = await findOwnedOrThrow(Folder, req.params.id, req.userId!);
  await Note.updateMany({ firebaseUid: req.userId, folderId: folder.id }, { $unset: { folderId: 1 } });
  if (folder.parentId) {
    await Folder.updateMany({ firebaseUid: req.userId, parentId: folder.id }, { parentId: folder.parentId });
  } else {
    await Folder.updateMany({ firebaseUid: req.userId, parentId: folder.id }, { $unset: { parentId: 1 } });
  }
  await folder.deleteOne();
  res.status(204).send();
}
