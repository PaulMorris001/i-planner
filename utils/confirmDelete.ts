import { Alert } from 'react-native';

// One consistent delete-confirmation prompt, used by every deletable entity
// (goals, tasks, classes, exams, habits) instead of five slightly different ones.
export function confirmDelete(itemLabel: string, onConfirm: () => void) {
  Alert.alert(`Delete ${itemLabel}?`, "This can't be undone.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
