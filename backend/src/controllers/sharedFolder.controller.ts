import crypto from 'crypto';
import { Request, Response } from 'express';
import { Folder, FolderDocument } from '../models/Folder';
import { Note } from '../models/Note';
import { SharedFolder, SharedFolderDocument } from '../models/SharedFolder';
import { SharedFolderImport } from '../models/SharedFolderImport';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { shortId } from '../utils/shortId';
import { slugFromShareId, titledShareId } from '../utils/shareSlug';
import { env } from '../config/env';
import { buildSharedFolderHtml, buildSharedFolderUnavailableHtml } from '../services/sharedFolderHtml';
import { copyOf } from './sharedNote.controller';

// One link can only carry so much, so a single share can't create thousands of notes
// in someone's account.
export const MAX_SHARED_NOTES = 100;
export const MAX_SHARED_FOLDERS = 50;
const TOO_LARGE_MESSAGE = `This folder is too large to share. A shared folder can hold up to ${MAX_SHARED_NOTES} notes and ${MAX_SHARED_FOLDERS} folders (including subfolders).`;
// How much of the folder the preview lists, so a big folder doesn't make a huge response.
const OUTLINE_NOTE_LIMIT = 60;

export type FolderExistingReason = 'own' | 'imported' | 'same';

interface TreeNote { id: string; title: string; body: string; folderId: string }
interface Tree {
  root: FolderDocument;
  // Root first, then every subfolder level by level (so a parent always precedes its children).
  folders: FolderDocument[];
  // Only the notes read for this request; never more than the share limit (or, for a
  // folder that is over the limit, just enough titles for the preview).
  notes: TreeNote[];
  // The real number of notes in the folders, from a count (not from what was read).
  noteCount: number;
  // Over what a single share may hold. Always checked against the CURRENT contents, so a
  // folder that was small when shared and grew since is refused just the same.
  tooLarge: boolean;
}

// A link carries the slug, the slug behind the folder's name (/f/<name>-<slug>), or the
// internal token. Only the slug after the last hyphen identifies the folder.
async function findShare(id: string) {
  const exact = await SharedFolder.findOne({ $or: [{ slug: id }, { token: id }] });
  if (exact || !id.includes('-')) return exact;
  return SharedFolder.findOne({ slug: slugFromShareId(id) });
}

// The shared folder with every subfolder under it and the notes in them, read from the
// SHARER's account as they are right now. null when the folder is gone.
//
// A link keeps showing the folder's CURRENT contents, so the folder can grow after it was
// shared (the public web page needs no sign-in and anyone can open it). Reads are therefore
// bounded however big it has become: subfolders and notes are counted first and only up to the
// share limit are ever loaded, and note text is read only when the caller needs it.
async function loadTree(shared: SharedFolderDocument, withBodies = false): Promise<Tree | null> {
  const root = await Folder.findOne({ _id: shared.folderId, firebaseUid: shared.firebaseUid });
  if (!root) return null;

  const folders: FolderDocument[] = [root];
  const seen = new Set<string>([root.id]);
  let frontier = [root.id];
  while (frontier.length && folders.length <= MAX_SHARED_FOLDERS) {
    const children = await Folder.find({ firebaseUid: shared.firebaseUid, parentId: { $in: frontier } })
      .sort({ name: 1 })
      .limit(MAX_SHARED_FOLDERS + 1);
    frontier = [];
    for (const child of children) {
      if (seen.has(child.id)) continue; // a parent loop can't happen normally; never loop forever if it did
      seen.add(child.id);
      folders.push(child);
      frontier.push(child.id);
    }
  }

  const filter = { firebaseUid: shared.firebaseUid, folderId: { $in: folders.map((f) => f.id) } };
  const noteCount = await Note.countDocuments(filter);
  const tooLarge = folders.length > MAX_SHARED_FOLDERS || noteCount > MAX_SHARED_NOTES;

  // Over the limit nothing can be added, so only enough titles for the preview are read.
  const notes = await Note.find(filter)
    .select(withBodies && !tooLarge ? 'title body folderId' : 'title folderId')
    .sort({ title: 1 })
    .limit(tooLarge ? OUTLINE_NOTE_LIMIT : MAX_SHARED_NOTES)
    .lean();
  return {
    root,
    folders,
    noteCount,
    tooLarge,
    notes: notes.map((n) => ({ id: String(n._id), title: n.title, body: n.body ?? '', folderId: String(n.folderId) })),
  };
}

// The notes of `tree` this account does NOT already have. A note counts as already
// had when the account holds a note with exactly the same title and text, so adding a
// folder never creates a duplicate of a note you own (including a copy that came back
// unchanged). Identical notes inside the shared folder itself are added once.
async function notesToAdd(uid: string, tree: Tree): Promise<TreeNote[]> {
  if (!tree.notes.length) return [];
  const copies = tree.notes.map((n) => ({ note: n, copy: copyOf(n) }));
  const mine = await Note.find({ firebaseUid: uid, title: { $in: [...new Set(copies.map((c) => c.copy.title))] } })
    .select('title body')
    .lean();
  const have = new Set(mine.map((n) => JSON.stringify([n.title, n.body])));
  const picked: TreeNote[] = [];
  for (const { note, copy } of copies) {
    const key = JSON.stringify([copy.title, copy.body]);
    if (have.has(key)) continue;
    have.add(key);
    picked.push(note);
  }
  return picked;
}

async function existingFolderFor(uid: string, shared: SharedFolderDocument, tree: Tree) {
  if (shared.firebaseUid === uid) return { folderId: tree.root.id as string, reason: 'own' as FolderExistingReason };
  const previous = await SharedFolderImport.findOne({ token: shared.token, firebaseUid: uid });
  if (previous) {
    const copy = await Folder.findOne({ _id: previous.folderId, firebaseUid: uid });
    if (copy) return { folderId: copy.id as string, reason: 'imported' as FolderExistingReason };
  }
  return null;
}

export async function createFolderShare(req: AuthedRequest, res: Response) {
  const folder = await findOwnedOrThrow(Folder, req.params.id, req.userId!);

  // Refuse early (and kindly) rather than hand out a link that can never be added.
  const probe = new SharedFolder({ token: 'probe', folderId: folder.id, firebaseUid: req.userId });
  const tree = await loadTree(probe);
  if (tree && tree.tooLarge) throw new ApiError(400, TOO_LARGE_MESSAGE, 'general');

  let shared = await SharedFolder.findOne({ folderId: folder.id, firebaseUid: req.userId });
  if (!shared) {
    try {
      shared = await SharedFolder.create({ token: crypto.randomUUID(), slug: shortId(), folderId: folder.id, firebaseUid: req.userId });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      const existing = await SharedFolder.findOne({ folderId: folder.id, firebaseUid: req.userId });
      if (!existing) throw err;
      shared = existing;
    }
  }
  res.json({ url: `${env.shareBaseUrl}/f/${titledShareId(folder.name, shared.slug!)}` });
}

// Unauthenticated: anyone with the link can see what is in the folder before signing in.
export async function getSharedFolderWebPage(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const shared = await findShare(req.params.token);
  const tree = shared ? await loadTree(shared) : null;
  if (!shared || !tree) {
    res.status(404).send(buildSharedFolderUnavailableHtml());
    return;
  }
  res.send(buildSharedFolderHtml(outline(tree), shared.slug ?? shared.token));
}

// What the preview lists: each folder (with its depth) and the titles of its notes.
function outline(tree: Tree) {
  const depth = new Map<string, number>([[tree.root.id, 0]]);
  for (const folder of tree.folders) {
    if (folder.id !== tree.root.id) depth.set(folder.id, (depth.get(folder.parentId ?? '') ?? 0) + 1);
  }
  let budget = OUTLINE_NOTE_LIMIT;
  const sections = tree.folders.map((folder) => {
    const own = tree.notes.filter((n) => n.folderId === folder.id);
    const shown = own.slice(0, Math.max(0, budget));
    budget -= shown.length;
    return { name: folder.name, depth: depth.get(folder.id) ?? 0, notes: shown.map((n) => n.title), moreNotes: own.length - shown.length };
  });
  return {
    name: tree.root.name,
    noteCount: tree.noteCount,
    folderCount: tree.folders.length - 1,
    sections,
  };
}

export async function getSharedFolderPreview(req: AuthedRequest, res: Response) {
  const shared = await findShare(req.params.token);
  const tree = shared ? await loadTree(shared, true) : null;
  if (!shared || !tree) throw new ApiError(404, 'This folder is no longer available.', 'general');

  let existing: { folderId: string | null; reason: FolderExistingReason } | null = await existingFolderFor(req.userId!, shared, tree);
  // Nothing in it that the account does not already have: there is nothing to add.
  if (!existing && !tree.tooLarge && tree.notes.length > 0 && (await notesToAdd(req.userId!, tree)).length === 0) {
    existing = { folderId: null, reason: 'same' };
  }
  res.json({ ...outline(tree), tooLarge: tree.tooLarge, existing });
}

export async function importSharedFolder(req: AuthedRequest, res: Response) {
  const uid = req.userId!;
  const shared = await findShare(req.params.token);
  const tree = shared ? await loadTree(shared, true) : null;
  if (!shared || !tree) throw new ApiError(404, 'This folder is no longer available.', 'general');

  // Their own folder, or a copy they already added: nothing is created.
  const existing = await existingFolderFor(uid, shared, tree);
  if (existing) {
    res.json({ alreadyImported: true, reason: existing.reason, folderId: existing.folderId, added: 0, skipped: 0 });
    return;
  }
  // An earlier copy that was deleted since leaves a stale record that would block this one.
  // Only a record whose folder is really gone is removed: a simultaneous add's fresh claim
  // always has its folder already (it is created first), so it is never deleted by mistake.
  const stale = await SharedFolderImport.findOne({ token: shared.token, firebaseUid: uid });
  if (stale && !(await Folder.exists({ _id: stale.folderId }))) await SharedFolderImport.deleteOne({ _id: stale._id });

  if (tree.tooLarge) throw new ApiError(400, TOO_LARGE_MESSAGE, 'general');

  const toAdd = await notesToAdd(uid, tree);
  if (tree.notes.length > 0 && toAdd.length === 0) {
    res.json({ alreadyImported: true, reason: 'same', folderId: null, added: 0, skipped: tree.notes.length });
    return;
  }

  // Claim first: only one simultaneous add of this link can get past this point.
  const rootCopy = await Folder.create({ firebaseUid: uid, name: tree.root.name });
  try {
    await SharedFolderImport.create({ token: shared.token, firebaseUid: uid, folderId: rootCopy.id });
  } catch (err) {
    await Folder.deleteOne({ _id: rootCopy.id });
    if (!isDuplicateKeyError(err)) throw err;
    const winner = await SharedFolderImport.findOne({ token: shared.token, firebaseUid: uid });
    res.json({ alreadyImported: true, reason: 'imported', folderId: winner?.folderId ?? null, added: 0, skipped: 0 });
    return;
  }

  const createdFolderIds: string[] = [rootCopy.id];
  const createdNoteIds: unknown[] = [];
  try {
    const newIdFor = new Map<string, string>([[tree.root.id, rootCopy.id]]);
    for (const folder of tree.folders) {
      if (folder.id === tree.root.id) continue;
      const parent = newIdFor.get(folder.parentId ?? '');
      if (!parent) continue; // its parent was not part of the share
      const made = await Folder.create({ firebaseUid: uid, name: folder.name, parentId: parent });
      createdFolderIds.push(made.id);
      newIdFor.set(folder.id, made.id);
    }
    if (toAdd.length) {
      const inserted = await Note.insertMany(
        toAdd.map((n) => ({ firebaseUid: uid, folderId: newIdFor.get(n.folderId) ?? rootCopy.id, ...copyOf(n) }))
      );
      createdNoteIds.push(...inserted.map((n) => n._id));
    }
  } catch (err) {
    // Never leave a half-copied folder behind.
    await Promise.all([
      Note.deleteMany({ _id: { $in: createdNoteIds } }),
      Folder.deleteMany({ _id: { $in: createdFolderIds } }),
      SharedFolderImport.deleteOne({ token: shared.token, firebaseUid: uid }),
    ]).catch(() => {});
    throw err;
  }

  res.status(201).json({
    alreadyImported: false,
    reason: null,
    folderId: rootCopy.id,
    added: toAdd.length,
    skipped: tree.notes.length - toAdd.length,
  });
}
