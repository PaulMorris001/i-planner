import { Alert, Platform, Share } from 'react-native';
import { requestConfirm } from '@/components/ui/ConfirmModal';
import { sharedFolderService } from '@/services/sharedFolder.service';

// Creates (or fetches) the folder's share link and opens the system share sheet with it.
async function createAndShare(folderId: string): Promise<void> {
  try {
    const { url } = await sharedFolderService.share(folderId);
    // Exactly one field per platform: iOS shares `message` and `url` as two separate
    // items, so passing both pasted the link twice. Android ignores `url` entirely.
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
  } catch (err) {
    console.error('[shareFolderLink] failed to create share link', err);
    const message = err instanceof Error && err.message ? err.message : 'Check your connection and try again.';
    Alert.alert("Couldn't create link", message);
  }
}

// A folder link is LIVE: it always shows what is in the folder (and its subfolders) at the
// moment someone opens it, not what was in it when it was shared. So a note filed in there
// later becomes visible to everyone holding the link. Say so before the link is made.
export function shareFolderLink(folderId: string): void {
  requestConfirm({
    title: 'Share this folder?',
    message:
      'Anyone with the link can see the titles of everything in this folder and its subfolders, and add copies to their own notes. ' +
      "The link always shows what's in the folder right now, so notes you add to it later will be visible too.",
    confirmLabel: 'Share link',
    destructive: false,
    onConfirm: () => {
      createAndShare(folderId);
    },
  });
}
