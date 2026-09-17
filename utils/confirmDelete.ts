import { Alert } from 'react-native';

// One consistent delete-confirmation prompt, used by every deletable entity
// (goals, tasks, classes, exams, habits, notes, folders) instead of several
// slightly different ones. `message` defaults to the usual "can't be undone"
// warning, but is overridable — e.g. a Folder's own deletion is permanent,
// but the notes inside it survive (unfiled, not deleted), which "This can't
// be undone" alone would misleadingly suggest otherwise.
export function confirmDelete(itemLabel: string, onConfirm: () => void, message = "This can't be undone.") {
  Alert.alert(`Delete ${itemLabel}?`, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
