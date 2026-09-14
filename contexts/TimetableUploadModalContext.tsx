import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

// Lets any screen open the Timetable Upload modal without owning its
// visibility state itself — the modal instance is mounted once at the root
// layout (see app/_layout.tsx, mirroring NewTaskModalContext/NewTaskModal),
// so the side menu (ProfileInfoModal) can open it from wherever it's shown.
interface TimetableUploadModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const TimetableUploadModalContext = createContext<TimetableUploadModalContextValue | null>(null);

export function TimetableUploadModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return <TimetableUploadModalContext.Provider value={value}>{children}</TimetableUploadModalContext.Provider>;
}

export function useTimetableUploadModal() {
  const ctx = useContext(TimetableUploadModalContext);
  if (!ctx) throw new Error('useTimetableUploadModal must be used within a TimetableUploadModalProvider');
  return ctx;
}
