import { Avatar } from '@/components/ui/Display';
import { formatCount } from '@/lib/format';
import type { LeaderboardRow } from '@/lib/types';

const MEDAL = ['#F59E0B', '#94A3B8', '#C2763A'];

export function displayName(row: LeaderboardRow): string {
  return row.name || row.email || row.handle || 'Unknown';
}

// The top three, with the leader raised in the middle (2nd, 1st, 3rd).
export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="podium">
      {[1, 0, 2].map((place) => {
        const row = rows[place];
        if (!row) return <div key={place} />;
        return (
          <div key={row.uid} className={`spot${place === 0 ? ' first' : ''}`}>
            <div className="medal" style={{ background: MEDAL[place] }}>
              {place + 1}
            </div>
            <Avatar name={displayName(row)} seed={row.uid} size={place === 0 ? 60 : 50} />
            <div className="pname">{displayName(row)}</div>
            <div className="ppoints">{formatCount(row.points)}</div>
            <div className="punit">pts</div>
          </div>
        );
      })}
    </div>
  );
}
