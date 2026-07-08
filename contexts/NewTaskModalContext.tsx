import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface NewTaskModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const NewTaskModalContext = createContext<NewTaskModalContextValue | null>(null);

export function NewTaskModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return <NewTaskModalContext.Provider value={value}>{children}</NewTaskModalContext.Provider>;
}

export function useNewTaskModal() {
  const ctx = useContext(NewTaskModalContext);
  if (!ctx) throw new Error('useNewTaskModal must be used within a NewTaskModalProvider');
  return ctx;
}
