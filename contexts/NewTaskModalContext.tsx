import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { Task } from '@/types/task.types';

interface NewTaskModalContextValue {
  isOpen: boolean;
  editingTask: Task | null;
  open: () => void;
  openForEdit: (task: Task) => void;
  close: () => void;
}

const NewTaskModalContext = createContext<NewTaskModalContextValue | null>(null);

export function NewTaskModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const value = useMemo(
    () => ({
      isOpen,
      editingTask,
      open: () => {
        setEditingTask(null);
        setIsOpen(true);
      },
      openForEdit: (task: Task) => {
        setEditingTask(task);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setEditingTask(null);
      },
    }),
    [isOpen, editingTask]
  );

  return <NewTaskModalContext.Provider value={value}>{children}</NewTaskModalContext.Provider>;
}

export function useNewTaskModal() {
  const ctx = useContext(NewTaskModalContext);
  if (!ctx) throw new Error('useNewTaskModal must be used within a NewTaskModalProvider');
  return ctx;
}
