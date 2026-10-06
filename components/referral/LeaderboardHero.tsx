import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import type { Leaderboard } from '@/types/referral.types';
import { motivationLine } from '@/utils/leaderboardCopy';
import { formatPoints, formatResetsIn } from '@/utils/referralFormat';

// The banner at the top of the leaderboard: your rank this week in big numbers, your
// points, when the week resets, and how far you are from the next place up.
export function LeaderboardHero({ board }: { board: Leaderboard | null }) {
  return (
    <LinearGradient
      colors={[Colors.primaryLight, Colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      {/* Decorative circles. */}
      <View style={[styles.blob, styles.blobOne]} />
      <View style={[styles.blob, styles.blobTwo]} />

      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>🏆  YOUR WEEK</Text>
        {board && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{formatResetsIn(board.weekEnd)}</Text>
          </View>
        )}
      </View>

      {!board ? (
        <ActivityIndicator color={Colors.white} style={{ marginVertical: 28 }} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.label}>RANK</Text>
              <Text style={styles.bigNumber}>{board.you.rank ? `#${board.you.rank}` : '–'}</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.label}>POINTS THIS WEEK</Text>
              <Text style={styles.bigNumber}>
                {formatPoints(board.you.points)}
                <Text style={styles.unit}> pts</Text>
              </Text>
            </View>
          </View>
          <View style={styles.tip}>
            <Text style={styles.tipText}>{motivationLine(board)}</Text>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, padding: 18, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  blobOne: { width: 170, height: 170, right: -50, top: -60 },
  blobTwo: { width: 110, height: 110, left: -30, bottom: -50 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.9)' },
  chip: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipText: { fontSize: 11.5, fontWeight: '700', color: Colors.white },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)' },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.75)' },
  bigNumber: { fontSize: 38, fontWeight: '800', color: Colors.white, marginTop: 2 },
  unit: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  tip: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  tipText: { fontSize: 13, fontWeight: '600', color: Colors.white, lineHeight: 18 },
});
