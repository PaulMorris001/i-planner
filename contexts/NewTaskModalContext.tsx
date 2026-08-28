import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { Task } from '@/types/task.types';

// Pre-fill for a brand-new task, distinct from editingTask (an existing Task
// with an id). Used by the "convert imported calendar event to task" flow —
// appleEventIds/googleEventId point NewTaskModal's save at the same existing
// calendar event instead of creating a duplicate.
export interface TaskDraft {
  title: string;
  dueDate?: string;
  time?: string;
  notes?: string;
  appleEventIds?: string[];
  googleEventId?: string;
  // ImportedCalendarEvent id this draft came from, if any — NewTaskModal
  // deletes that row on save so it stops showing in "review imported events".
  draftSourceId?: string;
}

interface NewTaskModalContextValue {
  isOpen: boolean;
  editingTask: Task | null;
  draft: TaskDraft | null;
  open: () => void;
  openForEdit: (task: Task) => void;
  openWithDraft: (draft: TaskDraft) => void;
  close: () => void;
}

const NewTaskModalContext = createContext<NewTaskModalContextValue | null>(null);

export function NewTaskModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  const value = useMemo(
    () => ({
      isOpen,
      editingTask,
      draft,
      open: () => {
        setEditingTask(null);
        setDraft(null);
        setIsOpen(true);
      },
      openForEdit: (task: Task) => {
        setEditingTask(task);
        setDraft(null);
        setIsOpen(true);
      },
      openWithDraft: (nextDraft: TaskDraft) => {
        setEditingTask(null);
        setDraft(nextDraft);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setEditingTask(null);
        setDraft(null);
      },
    }),
    [isOpen, editingTask, draft]
  );

  return <NewTaskModalContext.Provider value={value}>{children}</NewTaskModalContext.Provider>;
}

export function useNewTaskModal() {
  const ctx = useContext(NewTaskModalContext);
  if (!ctx) throw new Error('useNewTaskModal must be used within a NewTaskModalProvider');
  return ctx;
}
