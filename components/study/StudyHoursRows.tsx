import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ProfileInfoRow } from '@/components/profile/ProfileInfoRow';
import { studyService } from '@/services/study.service';
import { formatStudyDuration, localWeekStartIso } from '@/utils/studyFormat';
import type { StudyStats } from '@/types/study.types';

// "Study this week" and "Study all time" rows in the Profile info card (students and exam
// candidates only). Display only: the Study screen is opened from the side menu. Shows nothing
// until the totals have loaded, so it never flashes a wrong "0 h".
export function StudyHoursRows() {
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

  return (
    <>
      <ProfileInfoRow label="Study this week" value={formatStudyDuration(stats.weekMs)} />
      <ProfileInfoRow label="Study all time" value={formatStudyDuration(stats.allTimeMs)} />
    </>
  );
}
