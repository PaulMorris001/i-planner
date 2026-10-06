import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Leaderboard, LeaderboardEntry } from '@/types/referral.types';
import { avatarColor, avatarLetter } from '@/utils/leaderboardCopy';
import { formatPoints } from '@/utils/referralFormat';

const MEDAL = ['#F5B301', '#A8B0BC', '#C77B3B']; // gold, silver, bronze
const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHT = [112, 82, 62]; // 1st, 2nd, 3rd bar heights

interface ReferralLeaderboardProps {
  board: Leaderboard | null;
  failed: boolean;
  onRetry: () => void;
  // Your anonymous name, shown next to "You" when you're outside the top 10.
  handle: string;
}

// The weekly standings: an animated podium for the top three, rows for the rest, and
// your own position. Everyone appears
// under an anonymous code name. Standings reset every Monday.
export function ReferralLeaderboard({ board, failed, onRetry, handle }: ReferralLeaderboardProps) {
  if (!board) {
    return (
      <View style={styles.card}>
        {failed ? (
          <>
            <Text style={styles.empty}>Couldn&apos;t load the leaderboard.</Text>
            <Pressable onPress={onRetry} hitSlop={8}>
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
  const label = (entry: LeaderboardEntry) => (entry.isYou ? 'You' : entry.name);

  return (
    <View style={styles.card}>
      {board.top.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🚀</Text>
          <Text style={styles.emptyTitle}>The board is empty</Text>
          <Text style={styles.empty}>Be the first to earn points this week and take the top spot.</Text>
        </View>
      ) : (
        <>
          <Podium entries={podium} label={label} />
          {rest.map((entry, i) => (
            <Row key={`${i}-${entry.points}-${entry.isYou}`} entry={entry} name={label(entry)} />
          ))}
        </>
      )}

      {!youOnBoard && (
        <>
          <View style={styles.divider} />
          {board.you.rank ? (
            <Row
              entry={{ rank: board.you.rank, name: handle || 'You', points: board.you.points, isYou: true }}
              name={handle ? `You (${handle})` : 'You'}
            />
          ) : (
            <Text style={styles.empty}>You haven&apos;t earned points this week yet. Complete a task to get started!</Text>
          )}
        </>
      )}
    </View>
  );
}

export function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{avatarLetter(name)}</Text>
    </View>
  );
}

// 2nd on the left, 1st in the middle, 3rd on the right. The bars rise when the board
// first appears and the winner's crown bobs. With fewer than three people only the
// places that exist are drawn.
function Podium({ entries, label }: { entries: LeaderboardEntry[]; label: (e: LeaderboardEntry) => string }) {
  const [rise] = useState(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // 3rd, then 2nd, then 1st: the winner arrives last.
    const climb = Animated.stagger(
      180,
      [2, 1, 0].map((place) =>
        Animated.timing(rise[place], { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.2)), useNativeDriver: false })
      )
    );
    const bobbing = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    climb.start();
    bobbing.start();
    return () => {
      climb.stop();
      bobbing.stop();
    };
  }, [rise, bob]);

  const order = [1, 0, 2].filter((place) => place < entries.length);
  return (
    <View style={styles.podium}>
      {order.map((place) => {
        const entry = entries[place];
        const medal = Math.min(place, 2);
        return (
          <View key={place} style={styles.podiumColumn}>
            {place === 0 && (
              <Animated.Text style={[styles.crown, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}>
                👑
              </Animated.Text>
            )}
            <View style={[styles.avatarRing, { borderColor: MEDAL[medal] }, entry.isYou && styles.avatarRingYou]}>
              <Avatar name={entry.name} size={place === 0 ? 56 : 46} />
            </View>
            <Text style={[styles.podiumName, entry.isYou && styles.nameYou]} numberOfLines={1}>
              {label(entry)}
            </Text>
            <Text style={styles.podiumPoints}>{formatPoints(entry.points)} pts</Text>
            <Animated.View
              style={[
                styles.podiumBar,
                {
                  backgroundColor: MEDAL[medal],
                  height: rise[place].interpolate({ inputRange: [0, 1], outputRange: [0, PODIUM_HEIGHT[place]] }),
                },
              ]}
            >
              <Text style={styles.podiumMedal}>{MEDAL_EMOJI[medal]}</Text>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

function Row({ entry, name }: { entry: LeaderboardEntry; name: string }) {
  return (
    <View style={[styles.row, entry.isYou && styles.rowYou]}>
      <Text style={styles.rank}>{entry.rank}</Text>
      <Avatar name={entry.name} size={34} />
      <View style={{ flex: 1 }}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, entry.isYou && styles.nameYou]} numberOfLines={1}>
            {name}
          </Text>
          {entry.isYou && (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>YOU</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.points}>{formatPoints(entry.points)} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 14, paddingTop: 6 },
  podiumColumn: { flex: 1, alignItems: 'center' },
  crown: { fontSize: 24, marginBottom: 2 },
  avatarRing: { borderWidth: 3, borderRadius: 999, padding: 2 },
  avatarRingYou: { borderColor: Colors.primaryLight },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: Colors.white },
  podiumName: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary, marginTop: 6, maxWidth: '100%' },
  podiumPoints: { fontSize: 12.5, color: Colors.textSecondary, marginBottom: 6 },
  podiumBar: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  podiumMedal: { fontSize: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 14 },
  rowYou: { backgroundColor: Colors.infoSoft },
  rank: { width: 24, fontSize: 14.5, fontWeight: '800', color: Colors.textSecondary, textAlign: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, color: Colors.textPrimary, flexShrink: 1 },
  nameYou: { fontWeight: '800' },
  youPill: { backgroundColor: Colors.primaryLight, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  youPillText: { fontSize: 10.5, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  points: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  emptyBox: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10 },
  emptyEmoji: { fontSize: 38, marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  empty: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight, paddingVertical: 4, textAlign: 'center' },
});
