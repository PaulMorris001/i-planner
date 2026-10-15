import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { FilterChips, LoadMoreButton, SearchField } from '@/components/ui/Controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { AccountDialog } from '@/components/users/AccountDialog';
import { UserRow } from '@/components/users/UserRow';
import { useAccountModeration } from '@/hooks/useAccountModeration';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePagedList } from '@/hooks/usePagedList';
import { adminApi } from '@/lib/adminApi';
import { formatCount, plural } from '@/lib/format';
import type { AdminUserRow, UserFilter } from '@/lib/types';

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 350;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Subscribed' },
  { value: 'free', label: 'Free' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'admins', label: 'Admins' },
  { value: 'updates_on', label: 'Updates on' },
  { value: 'updates_off', label: 'Updates off' },
  { value: 'no_push', label: 'No push device' },
];

// Every account: search, filter, and suspend or restore. The list, the paging and the moderation
// flow each live in their own hook; the rows and the confirmation dialog are components.
export function UsersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const query = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  const list = usePagedList<AdminUserRow>(
    async (page) => {
      const result = await adminApi.users({ search: query, filter, page, pageSize: PAGE_SIZE });
      return { items: result.users, total: result.total };
    },
    (user) => user.uid,
    [query, filter]
  );

  // Update the row where it is. On the "Suspended" filter a restored account simply leaves.
  const moderation = useAccountModeration((user, suspended, reason) => {
    if (filter === 'suspended' && !suspended) {
      list.setItems((rows) => rows.filter((row) => row.uid !== user.uid));
      list.setTotal((total) => Math.max(0, total - 1));
      return;
    }
    list.setItems((rows) => rows.map((row) => (row.uid === user.uid ? { ...row, suspended, suspendedReason: reason } : row)));
  });

  return (
    <Page title="Users" subtitle={`${formatCount(list.total)} ${plural(list.total, 'account', 'accounts')}`}>
      <SearchField value={search} onChange={setSearch} placeholder="Search name, email or ID" />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {list.loading && list.items.length === 0 ? (
        <LoadingBlock label="Loading users…" />
      ) : list.error && list.items.length === 0 ? (
        <ErrorBlock message={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No users found" message={query ? 'Try a different name, email or ID.' : 'Nothing matches this filter yet.'} />
      ) : (
        <>
          <div className="user-list">
            {list.items.map((user) => (
              <UserRow key={user.uid} user={user} onSuspend={(u) => moderation.begin(u, 'suspend')} onRestore={(u) => moderation.begin(u, 'restore')} />
            ))}
          </div>
          {list.hasMore && <LoadMoreButton remaining={list.total - list.items.length} loading={list.loadingMore} onClick={list.loadMore} />}
        </>
      )}

      <AccountDialog
        action={moderation.action}
        reason={moderation.reason}
        onReasonChange={moderation.setReason}
        acting={moderation.acting}
        error={moderation.error}
        onConfirm={moderation.confirm}
        onCancel={moderation.cancel}
      />
    </Page>
  );
}
