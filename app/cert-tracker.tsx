import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';

const CERT_TOPICS = [
  'Capital Markets & Regulators',
  'Debt Instruments',
  'Equity Securities',
  'Packaged Products & Funds',
  'Options Fundamentals',
  'Customer Accounts',
  'Trading, Settlement & Custody',
  'Economic Factors',
  'Regulatory Framework',
  'Final Review & Practice Exams',
];

const CONFIDENCE_WORDS = ['', 'Shaky', 'Building', 'Steady', 'Strong', 'Exam-ready'];

export default function CertTracker() {
  const router = useRouter();
  const [topicsDone, setTopicsDone] = useState<boolean[]>(CERT_TOPICS.map((_, i) => i < 3));
  const [practiceLogged, setPracticeLogged] = useState(0);
  const [mockScores, setMockScores] = useState<number[]>([]);
  const [confidence, setConfidence] = useState(0);

  const certDone = topicsDone.filter(Boolean).length;
  const certTotal = CERT_TOPICS.length;
  const certPct = Math.round((certDone / certTotal) * 100);

  const lastMock = mockScores.length ? mockScores[mockScores.length - 1] : null;
  const mockLabel = lastMock != null ? `${lastMock}%` : '—';
  const confWord = CONFIDENCE_WORDS[confidence] || 'Steady';

  const toggleTopic = (i: number) => {
    setTopicsDone((prev) => prev.map((done, idx) => (idx === i ? !done : done)));
  };

  const logPractice = () => setPracticeLogged((n) => n + 10);

  const logMock = () => {
    const next = Math.min(62 + mockScores.length * 7, 95);
    setMockScores((prev) => [...prev, next]);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>SIE progress</Text>

      <LinearGradient
        colors={['#8B3FD1', '#5A2A99']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroRow}>
          <Text style={styles.heroLabel}>Topics complete</Text>
          <Text style={styles.heroFraction}>
            {certDone} / {certTotal}
          </Text>
        </View>
        <Text style={styles.heroPct}>{certPct}%</Text>
        <View style={styles.heroProgressTrack}>
          <View style={[styles.heroProgressFill, { width: `${certPct}%` }]} />
        </View>
      </LinearGradient>

      <Text style={styles.eyebrow}>TOPICS</Text>
      <View style={styles.topicsList}>
        {CERT_TOPICS.map((topic, i) => {
          const done = topicsDone[i];
          return (
            <Pressable key={topic} style={styles.topicRow} onPress={() => toggleTopic(i)}>
              <View
                style={[
                  styles.topicCheckbox,
                  done
                    ? { backgroundColor: '#8B3FD1' }
                    : { borderWidth: 1.9, borderColor: Colors.border },
                ]}
              >
                {done && <IconSymbol name="checkmark" color={Colors.white} size={13} />}
              </View>
              <Text style={styles.topicText}>{topic}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Practice questions</Text>
          <Text style={styles.statValue}>{practiceLogged}</Text>
          <Pressable style={styles.statButton} onPress={logPractice}>
            <Text style={styles.statButtonText}>+ Log 10</Text>
          </Pressable>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Last mock exam</Text>
          <Text style={styles.statValue}>{mockLabel}</Text>
          <Pressable style={styles.statButton} onPress={logMock}>
            <Text style={styles.statButtonText}>+ Add score</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.confidenceCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.confidenceTitle}>Confidence</Text>
          <Text style={styles.confidenceWord}>{confWord}</Text>
        </View>
        <View style={styles.confidenceBarsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              style={[
                styles.confidenceBar,
                { backgroundColor: confidence >= n ? '#8B3FD1' : Colors.border },
              ]}
              onPress={() => setConfidence(n)}
            />
          ))}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  heroCard: {
    marginHorizontal: Spacing.md,
    marginTop: 14,
    borderRadius: 18,
    padding: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.85,
  },
  heroFraction: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  heroPct: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.7,
    marginTop: 4,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.white,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: Spacing.md,
  },
  topicsList: {
    paddingHorizontal: Spacing.md,
    gap: 7,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  topicCheckbox: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 18,
    paddingHorizontal: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 5,
  },
  statButton: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    borderRadius: 11,
    paddingVertical: 9,
    alignItems: 'center',
  },
  statButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  confidenceCard: {
    marginTop: 11,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confidenceWord: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  confidenceBarsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  confidenceBar: {
    flex: 1,
    height: 36,
    borderRadius: 10,
  },
});
