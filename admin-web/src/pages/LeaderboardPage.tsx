import { useState } from 'react';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Podium } from '@/components/leaderboard/Podium';
import { Page } from '@/components/layout/Page';
import { LoadMoreButton, Segmented } from '@/components/ui/Controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { usePagedList } from '@/hooks/usePagedList';
import { adminApi } from '@/lib/adminApi';
import { formatCount, formatResetsIn, plural } from '@/lib/format';
import type { LeaderboardRow, LeaderboardScope } from '@/lib/types';

const PAGE_SIZE = 50;

// The full points table, this week or all time, with a podium for the first three.
export function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>('week');
  // The server says when the week ends; kept next to the list it belongs to.
  const [weekEnd, setWeekEnd] = useState<string | undefined>();

  const list = usePagedList<LeaderboardRow>(
    async (page) => {
      const result = await adminApi.leaderboard(scope, page, PAGE_SIZE);
      setWeekEnd(result.weekEnd);
      return { items: result.rows, total: result.total };
    },
    (row) => row.uid,
    [scope]
  );

  const podium = list.items.slice(0, 3);
  const rest = list.items.slice(3);

  return (
    <Page title="Leaderboard" subtitle={scope === 'week' ? (weekEnd ? formatResetsIn(weekEnd) : 'This week') : 'All-time points'}>
      <div>
        <Segmented
          value={scope}
          onChange={(next) => {
            list.setItems([]);
            setScope(next);
          }}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>

      {list.loading && list.items.length === 0 ? (
        <LoadingBlock label="Loading the table…" />
      ) : list.error && list.items.length === 0 ? (
        <ErrorBlock message={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyBlock icon="trophy" title="No points yet" message={scope === 'week' ? 'Nobody has earned points this week.' : 'Nobody has earned points yet.'} />
      ) : (
        <>
          <div className="summary">
            <b>{formatCount(list.total)}</b>
            <p>
              {plural(list.total, 'person has', 'people have')} points {scope === 'week' ? 'this week' : 'in total'}
            </p>
          </div>
          <Podium rows={podium} />
          <LeaderboardTable rows={rest} />
          {list.hasMore && <LoadMoreButton remaining={list.total - list.items.length} loading={list.loadingMore} onClick={list.loadMore} />}
        </>
      )}
    </Page>
  );
}
