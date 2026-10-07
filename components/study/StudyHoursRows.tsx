import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ProfileInfoRow } from '@/components/profile/ProfileInfoRow';
import { Routes } from '@/constants/routes';
import { studyService } from '@/services/study.service';
import { formatStudyDuration, localWeekStartIso } from '@/utils/studyFormat';
import type { StudyStats } from '@/types/study.types';

// "Study this week" and "Study all time" rows in the Profile info card (students and exam
// candidates only). Tapping either opens the Study screen. Shows nothing until the totals
// have loaded, so it never flashes a wrong "0 h".
export function StudyHoursRows() {
  const router = useRouter();
  const [stats, setStats] = useState<StudyStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      studyService
        .stats(localWeekStartIso())
        .then((s) => active && setStats(s))
        .catch((err) => console.error('[StudyHoursRows] failed to load study hours', err));
      return () => {
        active = false;
      };
    }, [])
  );

  if (!stats) return null;

  const open = () => router.push(Routes.STUDY);
  return (
    <>
      <ProfileInfoRow label="Study this week" value={formatStudyDuration(stats.weekMs)} onPress={open} />
      <ProfileInfoRow label="Study all time" value={formatStudyDuration(stats.allTimeMs)} onPress={open} />
    </>
  );
}
