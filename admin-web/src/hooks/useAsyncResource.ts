import { useCallback, useEffect, useRef, useState } from 'react';

// Loads something from the server for a page: `data`, a first-load `loading` flag, a pull-to-
// refresh `refreshing` flag, an `error` message with a `reload`. Optionally re-fetches on a timer
// (live dashboards). Reloading keeps the old data on screen, so numbers never flash to empty.
export function useAsyncResource<T>(load: () => Promise<T>, deps: unknown[] = [], options: { refreshEveryMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const requestId = useRef(0);

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const next = await loadRef.current();
      // Only the latest request may write: a slow earlier one must not overwrite fresher data.
      if (id !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError((err as { message?: string })?.message ?? 'Something went wrong. Try again.');
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!options.refreshEveryMs) return;
    const timer = setInterval(() => run('silent'), options.refreshEveryMs);
    return () => clearInterval(timer);
  }, [options.refreshEveryMs, run]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => run('initial'),
    refresh: () => run('refresh'),
    setData,
  };
}
