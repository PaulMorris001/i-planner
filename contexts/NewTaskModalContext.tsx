import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { Task } from '@/types/task.types';

// Pre-fill for a brand-new task — distinct from editingTask (which represents
// an existing Task with an id already in our system). Used by the "convert
// imported calendar event to task" flow: title/dueDate/time come from the
// event, appleEventIds/googleEventId point NewTaskModal's save at the same
// existing calendar event instead of creating a duplicate one.
export interface TaskDraft {
  title: string;
  dueDate?: string;
  time?: string;
  notes?: string;
  appleEventIds?: string[];
  googleEventId?: string;
  // The ImportedCalendarEvent id this draft came from, if any — NewTaskModal
  // deletes that row once the task is actually created, so the "review your
  // imported events" screen doesn't keep showing something already converted.
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
