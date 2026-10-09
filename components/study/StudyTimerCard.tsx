import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import { formatClock } from '@/utils/studyFormat';

// Points are earned for every full block of this length.
const POINT_BLOCK_MS = 30 * 60_000;

interface StudyTimerCardProps {
  sessionName: string;
  paused: boolean;
  // Study time so far, breaks not counted.
  elapsedMs: number;
  busy: boolean;
  onPauseResume: () => void;
  onStop: () => void;
}

// The running study timer: a big clock on the same kind of gradient banner as the leaderboard,
// with a bar showing how close the next block of points is. Goes grey while paused.
export function StudyTimerCard({ sessionName, paused, elapsedMs, busy, onPauseResume, onStop }: StudyTimerCardProps) {
  // A soft pulse on the "live" dot while the clock is running.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (paused) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [paused, pulse]);

  const intoBlockMs = elapsedMs % POINT_BLOCK_MS;
  const untilPointsMs = POINT_BLOCK_MS - intoBlockMs;

  return (
    <LinearGradient
      colors={paused ? ['#6B7280', '#374151'] : [Colors.primaryLight, Colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Decorative circles, like the leaderboard banner. */}
      <View style={[styles.blob, styles.blobOne]} />
      <View style={[styles.blob, styles.blobTwo]} />

      <View style={styles.topRow}>
        <View style={styles.statusPill}>
          <Animated.View style={[styles.dot, { opacity: pulse }]} />
          <Text style={styles.statusText}>{paused ? 'PAUSED' : 'STUDYING NOW'}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {sessionName}
      </Text>
      <Text style={styles.clock}>{formatClock(elapsedMs)}</Text>

      {paused ? (
        <Text style={styles.hint}>The timer is on hold. Break time is not counted.</Text>
      ) : (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, (intoBlockMs / POINT_BLOCK_MS) * 100)}%` }]} />
          </View>
          <Text style={styles.hint}>Next points in {formatClock(untilPointsMs)}</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <Pressable style={styles.pauseButton} onPress={onPauseResume} disabled={busy}>
          <Text style={styles.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable style={styles.stopButton} onPress={onStop} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.error} size="small" /> : <Text style={styles.stopText}>Stop</Text>}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, borderRadius: 22, padding: 18, overflow: 'hidden', alignItems: 'center' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  blobOne: { width: 190, height: 190, right: -60, top: -70 },
  blobTwo: { width: 120, height: 120, left: -35, bottom: -50 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  statusText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: Colors.white },
  name: { fontSize: 17, fontWeight: '700', color: Colors.white, marginTop: 12, maxWidth: '100%' },
  clock: { fontSize: 54, fontWeight: '800', color: Colors.white, marginTop: 4, fontVariant: ['tabular-nums'] },
  progressWrap: { alignSelf: 'stretch', marginTop: 10, alignItems: 'center' },
  progressTrack: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.white },
  hint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  pauseButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pauseText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  stopButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.white },
  stopText: { fontSize: 15, fontWeight: '800', color: Colors.error },
});
