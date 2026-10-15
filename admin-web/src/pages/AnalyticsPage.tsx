import { ActiveNowHero, PlansCard, PlatformsCard, SignupsChart } from '@/components/analytics/AnalyticsBlocks';
import { Page } from '@/components/layout/Page';
import { Card, StatTile } from '@/components/ui/Display';
import { ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { adminApi } from '@/lib/adminApi';
import { formatCount, plural } from '@/lib/format';

const REFRESH_EVERY_MS = 30_000;

// The home page: a live overview. Each block is its own component (components/analytics).
export function AnalyticsPage() {
  const { data, loading, refreshing, error, reload, refresh } = useAsyncResource(() => adminApi.analytics(), [], { refreshEveryMs: REFRESH_EVERY_MS });
  const updated = data ? new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <Page
      title="Analytics"
      subtitle={data ? `Updated ${updated} · refreshes itself` : 'Live overview'}
      actions={
        <button className="btn btn-ghost" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      {loading && !data ? (
        <LoadingBlock label="Loading analytics…" />
      ) : error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : data ? (
        <>
          <ActiveNowHero data={data} />
          <div className="grid-4">
            <StatTile icon="users" label="Total users" value={formatCount(data.users.total)} caption={`${formatCount(data.users.newLast30Days)} joined in 30 days`} />
            <StatTile icon="sparkle" label="New this week" value={formatCount(data.users.newLast7Days)} tint="#10B981" soft="#E3F5EE" />
            <StatTile icon="trophy" label="Subscribed" value={formatCount(data.plans.paid)} tint="#F59E0B" soft="#FEF3E2" />
            <StatTile icon="bell" label="Free plan" value={formatCount(data.plans.free)} tint="#8B5CF6" soft="#F1EBFD" />
          </div>
          <div className="grid-2">
            <PlansCard data={data} />
            <SignupsChart data={data} />
          </div>
          <PlatformsCard data={data} />
          {data.users.suspended > 0 && (
            <Card style={{ borderColor: '#f5c2c0', background: 'var(--danger-soft)' }}>
              <strong style={{ color: 'var(--danger)' }}>
                {formatCount(data.users.suspended)} suspended {plural(data.users.suspended, 'account', 'accounts')}
              </strong>
              <p className="footnote" style={{ marginTop: 4 }}>
                See them under Users → Suspended.
              </p>
            </Card>
          )}
        </>
      ) : null}
    </Page>
  );
}
