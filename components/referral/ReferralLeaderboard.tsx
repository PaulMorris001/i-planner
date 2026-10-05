import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useReferral } from '@/hooks/useReferral';
import { referralService } from '@/services/referral.service';
import type { Leaderboard, LeaderboardEntry } from '@/types/referral.types';
import { formatPoints, formatResetsIn } from '@/utils/referralFormat';

const MEDAL = ['#F5B301', '#A8B0BC', '#C77B3B']; // gold, silver, bronze
const PODIUM_HEIGHT = [78, 58, 44]; // 1st, 2nd, 3rd bar heights

// This week's top accounts on the Profile screen: a podium for the top three, rows
// for the rest, and the signed-in account's own position. Everyone appears under an
// anonymous code name. Standings reset every Monday (the server works each week out
// from that week's referrals, so there is nothing to clear).
export function ReferralLeaderboard() {
  const { code, handle, points } = useReferral();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setBoard(await referralService.leaderboard());
    } catch (err) {
      console.error('[ReferralLeaderboard] failed to load', err);
      setFailed(true);
    }
  }, []);

  // Reloads when the account's own points change (a friend just joined).
  useEffect(() => {
    if (code) load();
  }, [code, points, load]);

  if (!code) return null;

  if (!board) {
    return (
      <View style={styles.card}>
        {failed ? (
          <>
            <Text style={styles.empty}>Couldn&apos;t load the leaderboard.</Text>
            <Pressable onPress={load} hitSlop={8}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={Colors.primaryLight} />
        )}
      </View>
    );
  }

  const podium = board.top.slice(0, 3);
  const rest = board.top.slice(3);
  const youOnBoard = board.top.some((entry) => entry.isYou);
  // The server names you by your code name like everyone else; "You" is added here.
  const label = (entry: LeaderboardEntry) => (entry.isYou ? 'You' : entry.name);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.resets}>{formatResetsIn(board.weekEnd)}</Text>
      </View>

      {board.top.length === 0 ? (
        <Text style={styles.empty}>No points yet this week. Share your code to take the top spot.</Text>
      ) : (
        <>
          <Podium entries={podium} label={label} />
          {rest.map((entry, i) => (
            <Row key={`${i}-${entry.points}-${entry.isYou}`} rank={entry.rank} name={label(entry)} points={entry.points} highlight={entry.isYou} />
          ))}
        </>
      )}

      {!youOnBoard && (
        <>
          <View style={styles.divider} />
          {board.you.rank ? (
            <Row rank={board.you.rank} name={handle ? `You (${handle})` : 'You'} points={board.you.points} highlight />
          ) : (
            <Text style={styles.empty}>You haven&apos;t earned points this week yet.</Text>
          )}
        </>
      )}
    </View>
  );
}

// 2nd on the left, 1st in the middle, 3rd on the right. With fewer than three
// people only the places that exist are drawn.
function Podium({ entries, label }: { entries: LeaderboardEntry[]; label: (e: LeaderboardEntry) => string }) {
  const order = [1, 0, 2].filter((place) => place < entries.length);
  return (
    <View style={styles.podium}>
      {order.map((place) => {
        const entry = entries[place];
        // Ties share a rank, so the medal follows the rank, not the position.
        const medalIndex = Math.min(entry.rank, 3) - 1;
        return (
          <View key={place} style={styles.podiumColumn}>
            <IconSymbol name="flame.fill" color={MEDAL[medalIndex]} size={place === 0 ? 30 : 24} />
            <Text style={[styles.podiumName, entry.isYou && styles.nameYou]} numberOfLines={1}>
              {label(entry)}
            </Text>
            <Text style={styles.podiumPoints}>{formatPoints(entry.points)} pts</Text>
            <View
              style={[
                styles.podiumBar,
                { height: PODIUM_HEIGHT[place], backgroundColor: MEDAL[medalIndex] },
                entry.isYou && styles.podiumBarYou,
              ]}
            >
              <Text style={styles.podiumRank}>{entry.rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Row({ rank, name, points, highlight }: { rank: number; name: string; points: number; highlight?: boolean }) {
  return (
    <View style={[styles.row, highlight && styles.rowYou]}>
      <Text style={styles.rank}>{rank}</Text>
      <Text style={[styles.name, highlight && styles.nameYou]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.points}>{formatPoints(points)} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  resets: { fontSize: 12, color: Colors.textSecondary },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  podiumColumn: { flex: 1, alignItems: 'center' },
  podiumName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, marginTop: 4, maxWidth: '100%' },
  podiumPoints: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  podiumBar: { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, alignItems: 'center', justifyContent: 'center' },
  podiumBarYou: { borderWidth: 2, borderColor: Colors.primaryLight },
  podiumRank: { fontSize: 20, fontWeight: '800', color: Colors.white },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  rowYou: { backgroundColor: Colors.infoSoft },
  rank: { width: 28, fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  name: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  nameYou: { fontWeight: '700' },
  points: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  empty: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 6 },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight, paddingVertical: 4 },
});
