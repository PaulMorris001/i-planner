import { useOnboarding } from '@/hooks/useOnboarding';

export type PathKey = 'student' | 'exam' | 'professional';

// Maps the onboarding focus profile to the coarse "which of the 3 dashboards"
// key used to branch path-specific UI — shared so any screen (not just
// dashboard.tsx) can gate content by path without duplicating this mapping.
export function toPathKey(focusProfile: string | null): PathKey {
  if (focusProfile === 'student') return 'student';
  if (focusProfile === 'exam_candidate') return 'exam';
  return 'professional';
}

export function usePathKey(): PathKey {
  const { focusProfile } = useOnboarding();
  return toPathKey(focusProfile);
}
