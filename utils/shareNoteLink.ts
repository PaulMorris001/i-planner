import { Alert, Platform, Share } from 'react-native';
import { sharedNoteService } from '@/services/sharedNote.service';

// Creates (or fetches) the note's share link and opens the system share sheet with it. The link
// always shows the note's CURRENT text, so unsaved edits on screen are not part of it.
export async function shareNoteLink(noteId: string): Promise<void> {
  try {
    const { url } = await sharedNoteService.share(noteId);
    // Exactly one field per platform. iOS shares `message` and `url` as two separate items, so
    // passing both made WhatsApp/Messages paste the link twice. `url` gets iOS's native link
    // preview; Android ignores `url` entirely and only shares `message`.
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
  } catch (err) {
    console.error('[shareNoteLink] failed to create share link', err);
    Alert.alert("Couldn't create link", 'Check your connection and try again.');
  }
}
