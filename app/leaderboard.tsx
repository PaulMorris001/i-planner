import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { LeaderboardHero } from '@/components/referral/LeaderboardHero';
import { ReferralCodeCard } from '@/components/referral/ReferralCodeCard';
import { ReferralLeaderboard } from '@/components/referral/ReferralLeaderboard';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useReferral } from '@/hooks/useReferral';

// The weekly leaderboard on its own page (opened from the dashboard card and the side
// menu). The referral code sits at the very top so it stays in reach however long the
// standings get: sharing it is how points are earned fastest.
export default function Leaderboard() {
  const { refresh, handle, rewards } = useReferral();
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on pull-to-refresh so the standings reload along with the profile.
  const [refreshKey, setRefreshKey] = useState(0);
  const { board, failed, reload } = useLeaderboard(refreshKey);

  // Points now come from many places (tasks, habits, bills, study...), so refresh the
  // total when this page opens.
  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScreenWrapper
      backgroundColor={Colors.offWhite}
      scroll
      style={styles.scrollContent}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      {/* BackButton and PageHeader carry their own 16pt side padding; this brings them in line with the 24pt body. */}
      <View style={styles.headerWrap}>
        <BackButton />
        <PageHeader title="Leaderboard" subtitle="Earn points, climb the board, beat your friends." />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>INVITE FRIENDS</Text>
        <Text style={styles.sectionDesc}>
          Share your code. You get {rewards.referrer} points and your friend gets {rewards.referred} points when they join with it.
        </Text>
        <ReferralCodeCard />

        <View style={styles.heroWrap}>
          <LeaderboardHero board={board} />
        </View>

        <Text style={styles.eyebrow}>THIS WEEK&apos;S TOP 10</Text>
        <ReferralLeaderboard board={board} failed={failed} onRetry={reload} handle={handle} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 48 },
  headerWrap: { paddingHorizontal: Spacing.sm },
  body: { paddingHorizontal: Spacing.lg },
  heroWrap: { marginTop: Spacing.lg },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: 4,
  },
  sectionDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 11 },
});
