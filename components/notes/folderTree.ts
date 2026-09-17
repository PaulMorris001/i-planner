import type { Folder } from '@/types/folder.types';

// Folders can nest arbitrarily deep (see backend/src/models/Folder.ts), but
// the flat `folders` array from useFolders() has no tree structure built in —
// this walks it to find every folder underneath `rootId`, direct or not.
// Used to scope a folder's search to its whole subtree, not just its direct
// children. O(n^2) worst case, fine for a personal planner's folder counts.
export function getDescendantFolderIds(folders: Folder[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        added = true;
      }
    }
  }
  return result;
}

// "Grandparent / Parent / Name" — lets FolderPickerModal disambiguate folders
// that share a name at different nesting levels, and shows where a folder
// actually sits instead of just its own name in isolation. `seen` guards
// against looping forever if parentId data ever formed a cycle (shouldn't
// happen — folders can only ever be created under an existing parent, never
// re-parented — but walking a chain of untrusted-shaped data safely is cheap).
export function getFolderPath(folders: Folder[], folderId: string): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}
