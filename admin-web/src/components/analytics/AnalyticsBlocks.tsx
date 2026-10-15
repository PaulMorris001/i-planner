import { Card, MeterBar, SectionTitle } from '@/components/ui/Display';
import { formatCount } from '@/lib/format';
import type { AdminAnalytics } from '@/lib/types';

// The blocks of the analytics home page. Each takes the analytics payload and draws one thing.

// The headline: how many people are using the app right now.
export function ActiveNowHero({ data }: { data: AdminAnalytics }) {
  return (
    <div className="hero">
      <div className="live">
        <i /> ACTIVE NOW
      </div>
      <div className="big">{formatCount(data.activity.activeNow)}</div>
      <div className="sub">people used the app in the last 5 minutes</div>
      <div className="hero-stats">
        <div>
          <b>{formatCount(data.activity.last24Hours)}</b>
          <span>last 24 hours</span>
        </div>
        <div>
          <b>{formatCount(data.activity.last7Days)}</b>
          <span>last 7 days</span>
        </div>
        <div>
          <b>{formatCount(data.users.total)}</b>
          <span>all users</span>
        </div>
      </div>
    </div>
  );
}

const TIERS = [
  { key: 'student', label: 'Student', color: '#3B82F6' },
  { key: 'professional', label: 'Professional', color: '#8B5CF6' },
  { key: 'premium', label: 'Premium', color: '#F59E0B' },
] as const;

// Subscribed vs free, and how the subscribed split across plans.
export function PlansCard({ data }: { data: AdminAnalytics }) {
  const { plans, users } = data;
  const paidShare = users.total ? plans.paid / users.total : 0;
  return (
    <Card>
      <SectionTitle title="Subscriptions" hint={`${Math.round(paidShare * 100)}% of users are on a paid plan`} />
      <div className="split">
        <div>
          <div className="value">{formatCount(plans.paid)}</div>
          <div className="name">Subscribed</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="value">{formatCount(plans.free)}</div>
          <div className="name">Free plan</div>
        </div>
      </div>
      <MeterBar fraction={paidShare} color="var(--success)" height={10} />
      <div className="rows">
        {TIERS.map((tier) => (
          <div key={tier.key} className="row-line">
            <span className="dot" style={{ background: tier.color }} />
            <span className="name">{tier.label}</span>
            <span className="value">{formatCount(plans[tier.key])}</span>
          </div>
        ))}
      </div>
      {plans.comped > 0 && <p className="footnote">{formatCount(plans.comped)} of the paid accounts are complimentary.</p>}
    </Card>
  );
}

const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// New accounts per day over the last two weeks; today is the dark bar.
export function SignupsChart({ data }: { data: AdminAnalytics }) {
  const days = data.signupsByDay;
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <Card>
      <SectionTitle title="New sign-ups" hint={`${formatCount(total)} in the last ${days.length} days`} />
      <div className="chart">
        {days.map((day, index) => (
          <div key={day.date} className="col" title={`${day.date}: ${day.count}`}>
            <span className="count">{day.count > 0 ? day.count : ''}</span>
            <div className="track">
              <div className={`fill${index === days.length - 1 ? ' today' : ''}`} style={{ height: `${Math.max(3, (day.count / max) * 100)}%` }} />
            </div>
            <span className="day">{WEEKDAY_LETTER[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Accounts by the device they use the app on. These are accounts with the app installed and signed
// in, not store download counts (those only exist in the App Store and Play consoles).
export function PlatformsCard({ data }: { data: AdminAnalytics }) {
  const { devices, users } = data;
  const total = Math.max(1, users.total);
  const rows = [
    { label: 'iPhone / iPad', value: devices.ios, color: 'var(--text)' },
    { label: 'Android', value: devices.android, color: 'var(--success)' },
    { label: 'No device yet', value: devices.noDevice, color: 'var(--text-3)' },
  ];
  return (
    <Card>
      <SectionTitle title="Platforms" hint="Accounts by the device they use the app on" />
      <div className="rows" style={{ marginTop: 0 }}>
        {rows.map((row) => (
          <div key={row.label}>
            <div className="row-line" style={{ marginBottom: 6 }}>
              <span className="name">{row.label}</span>
              <span className="value">{formatCount(row.value)}</span>
            </div>
            <MeterBar fraction={row.value / total} color={row.color} />
          </div>
        ))}
      </div>
      <p className="footnote">
        These are accounts with the app on a device, not store downloads. The App Store and Google Play only report download counts in their own consoles, so
        they are not available here.
      </p>
    </Card>
  );
}
