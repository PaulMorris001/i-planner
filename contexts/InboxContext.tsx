import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/config/firebase";
import { inboxService, type InboxItem } from "@/services/inbox.service";

interface InboxContextValue {
  items: InboxItem[];
  // Messages not opened yet. Drives the badge on the bell and on the menu button.
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

// The in-app notification inbox: what the server sent this account. One copy of the list and the
// unread count is shared, so the badge on the menu button and the one on the bell never disagree.
// It re-reads at sign-in, whenever the app comes to the front, and when a push arrives while the
// app is open.
export function InboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const signedIn = useRef(false);
  // The latest list, so markRead can tell whether the message was unread without depending on
  // when React runs a state updater.
  const itemsRef = useRef<InboxItem[]>([]);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    if (!signedIn.current) return;
    try {
      const result = await inboxService.list();
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error("[InboxProvider] failed to load notifications", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      signedIn.current = !!user;
      if (!user) {
        setItems([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }
      await refresh();
      setLoading(false);
    });
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      refresh();
    });
    return () => {
      appState.remove();
      received.remove();
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const wasUnread = itemsRef.current.some((row) => row.id === id && !row.read);
    if (!wasUnread) return;
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, read: true } : row)));
    setUnreadCount((n) => Math.max(0, n - 1));
    try {
      await inboxService.markRead(id);
    } catch (err) {
      console.error("[InboxProvider] failed to mark a notification read", err);
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((rows) => rows.map((row) => ({ ...row, read: true })));
    setUnreadCount(0);
    try {
      await inboxService.markAllRead();
    } catch (err) {
      console.error("[InboxProvider] failed to mark all notifications read", err);
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used inside InboxProvider");
  return ctx;
}
