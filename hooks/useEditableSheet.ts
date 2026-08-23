import { useState } from 'react';

// Shared state shape for a "list screen with an add/edit sheet and a
// long-press action sheet" — was independently redefined (same 3-state
// wiring: an open/editing pair for the sheet, a separate target for the
// action sheet) in classes.tsx, exams.tsx, goals.tsx, and habits.tsx before
// being consolidated here. Each screen's actual save/remove logic (Apple
// Calendar sync, exam-plan updates, etc.) stays in the screen — this only
// owns the "which sheet is open, editing what" bookkeeping around it.
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
