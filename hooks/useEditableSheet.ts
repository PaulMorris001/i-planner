import { useState } from 'react';

// Shared state for a "list screen with an add/edit sheet and a long-press action
// sheet": an open/editing pair for the sheet plus a separate target for the action
// sheet. Each screen's own save/remove logic stays in the screen — this only owns
// the "which sheet is open, editing what" bookkeeping.
export function useEditableSheet<T>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [actionTarget, setActionTarget] = useState<T | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  return { open, editing, actionTarget, setActionTarget, openNew, openEdit, close };
}
