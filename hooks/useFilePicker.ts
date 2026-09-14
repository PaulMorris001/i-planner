import { useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

// Matches every backend extraction service's MIME_BY_EXT (see
// backend/src/services/aiFileInput.ts) — the backend derives the actual MIME
// type from the filename itself (safer than trusting the OS-reported one),
// so this list only needs to keep the native document picker's own filter in
// sync with what the server will accept. Images are deliberately NOT here —
// see pickPhoto below, launched from a separate button.
export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];

// Common shape both pickers normalize into, so callers' preview/process logic
// doesn't care which one was used.
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  // Only ever set for a photo — the picker encodes it directly, sidestepping
  // a second full-file disk read through expo-file-system at process time.
  // Documents don't have this option, so callers still read them via
  // `new File(uri).base64()` themselves.
  base64?: string;
}

// Human-readable size, e.g. "2.4 MB" / "180 KB" — a bare byte count reads as
// meaningless on a file-preview screen.
export function formatFileSize(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Shared by every "upload a document or photo for AI extraction" modal
// (SyllabusUploadModal, TimetableUploadModal, ...) — same two pickers, same
// PickedFile normalization, same permission handling. Only picks and stores
// the file; callers decide what step/screen to move to afterward.
// `defaultPhotoName` (no extension) is the fallback filename used when the
// photo library doesn't report one (limited library access) — the backend
// derives the real MIME type from this filename's extension, so it must
// still end up with a recognized one.
export function useFilePicker(defaultPhotoName: string) {
  const [pickedAsset, setPickedAsset] = useState<PickedFile | null>(null);

  const pickDocument = async (): Promise<PickedFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_DOCUMENT_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    const file: PickedFile = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size };
    setPickedAsset(file);
    return file;
  };

  // A photographed document naturally comes from the Camera Roll/Photos, not
  // Files — expo-image-picker's library picker, not expo-document-picker.
  const pickPhoto = async (): Promise<PickedFile | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to choose a photo.');
      return null;
    }
    // quality: 1 (no compression) on a modern phone photo can be a 10-20+ MB
    // file — base64-encoding something that size (both the disk read and the
    // network upload) is heavy enough to visibly freeze the UI thread for a
    // long stretch. 0.6 is still plenty readable for a document photo and
    // cuts that dramatically. base64: true has the picker encode it
    // directly, so processing doesn't need a second full-file read.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    // fileName can come back null with limited photo-library access — a
    // recognized extension is required either way, since the backend derives
    // the real MIME type from the filename itself.
    const name = asset.fileName ?? `${defaultPhotoName}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    const file: PickedFile = {
      uri: asset.uri,
      name,
      mimeType,
      size: asset.fileSize,
      base64: asset.base64 ?? undefined,
    };
    setPickedAsset(file);
    return file;
  };

  const reset = () => setPickedAsset(null);

  return { pickedAsset, pickDocument, pickPhoto, reset };
}
