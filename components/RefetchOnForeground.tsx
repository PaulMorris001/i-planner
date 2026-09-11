import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { waitForNoPendingMutations } from '@/utils/pendingMutations';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useNotes } from '@/hooks/useNotes';
import { useBills } from '@/hooks/useBills';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useGoals } from '@/hooks/useGoals';
import { usePlan } from '@/hooks/usePlan';
import { useSyllabi } from '@/hooks/useSyllabi';

// Renders nothing — exists purely to re-fetch every data context whenever the
// app returns to the foreground. Every context here already fetches once on
// auth-state-change (login/app-launch) and never again on its own, so the
// same account open on a second device stays stale until something explicit
// re-fetches. A live push (websockets/change streams) would be substantial
// new backend infrastructure for a personal-planner app where two devices are
// realistically used sequentially, not simultaneously — this covers that real
// case far more cheaply: background the app on device A, make a change on
// device B, come back to A, and it catches up right away. Pull-to-refresh
// (see each screen's ScreenWrapper) covers the "still looking at the same
// screen" case this can't.
//
// Rendered once, deep inside every provider it reads from — see app/_layout.tsx.
export function RefetchOnForeground() {
  const { user } = useAuth();
  const { refetch: refetchTasks } = useTasks();
  const { refetch: refetchHabits } = useHabits();
  const { refetch: refetchNotes } = useNotes();
  const { refetch: refetchBills } = useBills();
  const { refetch: refetchSavingsGoals } = useSavingsGoals();
  const { refetch: refetchGoals } = useGoals();
  const { refetch: refetchPlan } = usePlan();
  const { refetch: refetchSyllabi } = useSyllabi();

  // Refs, not deps on the effect below — these values are read at the moment
  // the app actually foregrounds, not captured stale at effect-setup time, so
  // the AppState subscription itself never needs to be torn down and rebuilt
  // just because a context re-rendered or the user logged in/out meanwhile.
  const latest = useRef({
    user, refetchTasks, refetchHabits, refetchNotes, refetchBills,
    refetchSavingsGoals, refetchGoals, refetchPlan, refetchSyllabi,
  });
  latest.current = {
    user, refetchTasks, refetchHabits, refetchNotes, refetchBills,
    refetchSavingsGoals, refetchGoals, refetchPlan, refetchSyllabi,
  };

  useEffect(() => {
    const appState = { current: AppState.currentState };

    const onChange = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const r = latest.current;
        // Skip entirely while logged out (Welcome/Login/onboarding, or mid
        // sign-out) — every one of these contexts' fetchers hits an
        // authedRequest that needs a real Firebase user, and firing all 8 off
        // with no token would just be 8 guaranteed 401s and console noise on
        // every foreground/background cycle spent on those screens.
        if (!r.user) return;
        // Wait out any save/create/delete still in flight first — a GET
        // landing mid-write would read pre-edit server data and stomp the
        // correct optimistic local state with it. Not awaited by the
        // listener itself (AppState doesn't care about the return value);
        // this just delays the batch below, best-effort either way.
        waitForNoPendingMutations().then(() =>
          // In parallel — a transient failure here isn't worth surfacing to
          // the user; the next foreground or pull-to-refresh will just try
          // again.
          Promise.all([
            r.refetchTasks(), r.refetchHabits(), r.refetchNotes(), r.refetchBills(),
            r.refetchSavingsGoals(), r.refetchGoals(), r.refetchPlan(), r.refetchSyllabi(),
          ])
        ).catch((err) => console.error('[RefetchOnForeground] failed to refetch on foreground', err));
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  return null;
}
