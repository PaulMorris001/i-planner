import { requestConfirm } from '@/components/ui/ConfirmModal';

// One consistent delete-confirmation prompt, used by every deletable entity
// (goals, tasks, classes, exams, habits, notes, folders) instead of several
// slightly different ones. `message` defaults to the usual "can't be undone"
// warning, but is overridable — e.g. a Folder's own deletion is permanent,
// but the notes inside it survive (unfiled, not deleted), which "This can't
// be undone" alone would misleadingly suggest otherwise.
//
// Renders as the app's own custom modal (ConfirmModal.tsx), not a native
// Alert — see that file for how a plain function call here reaches a modal
// mounted once at the app root.
export function confirmDelete(itemLabel: string, onConfirm: () => void, message = "This can't be undone.") {
  requestConfirm({
    title: `Delete ${itemLabel}?`,
    message,
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm,
  });
}
