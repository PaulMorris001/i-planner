import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { studyService } from '@/services/study.service';
import { formatStudyDuration, localWeekStartIso } from '@/utils/studyFormat';
import type { StudyStats } from '@/types/study.types';

// "Study: 5 h this week · 50 h all time" in the Profile info card (students and
// exam candidates only). Tapping it opens the Study screen. Shows nothing until the
// totals have loaded, so it never flashes a wrong "0 h".
export function StudyHoursLine() {
  const router = useRouter();
  const [stats, setStats] = useState<StudyStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      studyService
        .stats(localWeekStartIso())
        .then((s) => active && setStats(s))
        .catch((err) => console.error('[StudyHoursLine] failed to load study hours', err));
      return () => {
        active = false;
      };
    }, [])
  );

  if (!stats) return null;

  return (
    <Pressable onPress={() => router.push(Routes.STUDY)} hitSlop={6}>
      <Text style={styles.text}>
        Study · {formatStudyDuration(stats.weekMs)} this week · {formatStudyDuration(stats.allTimeMs)} all time
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: Colors.primaryLight, fontWeight: '600', marginTop: 1 },
});
