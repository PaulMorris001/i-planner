import { displayName } from '@/components/leaderboard/Podium';
import { Avatar, Card } from '@/components/ui/Display';
import { formatCount } from '@/lib/format';
import type { LeaderboardRow } from '@/lib/types';

// Everyone below the podium: rank, name, email and handle, points.
export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card flush>
      {rows.map((row) => (
        <div key={row.uid} className="table-row">
          <span className="rank">{row.rank}</span>
          <Avatar name={displayName(row)} seed={row.uid} size={38} />
          <div className="grow">
            <div className="pname">{displayName(row)}</div>
            <div className="psub">
              {row.email}
              {row.handle ? ` · ${row.handle}` : ''}
            </div>
          </div>
          <span className="points">{formatCount(row.points)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="center-block">That&apos;s everyone with points.</p>}
    </Card>
  );
}
