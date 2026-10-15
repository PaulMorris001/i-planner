import { useCallback, useEffect, useRef, useState } from 'react';

export interface PagedResult<T> {
  items: T[];
  total: number;
}

// A list that loads page by page ("Show more"): the first page replaces the list, later pages are
// appended (skipping any item already there), and pull-to-refresh reloads the first page. Only the
// newest request may write, so a slow earlier one can never overwrite fresher data. `deps` are
// what the list depends on (a search text, a filter): changing them starts again from page one.
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<PagedResult<T>>,
  getKey: (item: T) => string,
  deps: unknown[]
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const latest = useRef({ fetchPage, getKey });
  latest.current = { fetchPage, getKey };

  const load = useCallback(async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'replace') setLoading(true);
    if (mode === 'append') setLoadingMore(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await latest.current.fetchPage(nextPage);
      if (id !== requestId.current) return;
      setItems((previous) => {
        if (mode !== 'append') return result.items;
        const seen = new Set(previous.map(latest.current.getKey));
        return [...previous, ...result.items.filter((item) => !seen.has(latest.current.getKey(item)))];
      });
      setTotal(result.total);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError((err as { message?: string })?.message ?? 'Could not load this list. Try again.');
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load(1, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    items,
    total,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore: items.length < total,
    loadMore: () => load(page + 1, 'append'),
    reload: () => load(1, 'replace'),
    refresh: () => load(1, 'refresh'),
    // For changes made in place (a suspended account), without refetching the whole list.
    setItems,
    setTotal,
  };
}
