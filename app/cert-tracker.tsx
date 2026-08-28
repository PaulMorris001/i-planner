import { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { StatCard } from '@/components/ui/StatCard';
import { Colors, Spacing } from '@/constants/theme';
import { usePlan } from '@/hooks/usePlan';

const CONFIDENCE_WORDS = ['', 'Shaky', 'Building', 'Steady', 'Strong', 'Exam-ready'];

export default function CertTracker() {
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const { examPlan, toggleExamTopic, logExamPractice, logExamMockScore, setExamConfidence } = usePlan();
  // UI-only — whether an entry row is expanded and what's currently typed
  // into it. The actual logged numbers (practiceQuestionsLogged, mockScores,
  // confidence) live on the Exam record via PlanContext, not here.
  const [practiceInputOpen, setPracticeInputOpen] = useState(false);
  const [practiceInputValue, setPracticeInputValue] = useState('');
  const [savingPractice, setSavingPractice] = useState(false);
  const [mockInputOpen, setMockInputOpen] = useState(false);
  const [mockInputValue, setMockInputValue] = useState('');
  const [savingMock, setSavingMock] = useState(false);

  // Falls back to the first exam if no id was passed (e.g. a stale deep link).
  const exam = examPlan.exams.find((e) => e.id === examId) ?? examPlan.exams[0];
  const topics = exam?.topics ?? [];
  const certDone = topics.filter((t) => t.done).length;
  const certTotal = topics.length;
  const certPct = certTotal > 0 ? Math.round((certDone / certTotal) * 100) : 0;

  const practiceLogged = exam?.practiceQuestionsLogged ?? 0;
  const mockScores = exam?.mockScores ?? [];
  const confidence = exam?.confidence ?? 0;
  const lastMock = mockScores.length ? mockScores[mockScores.length - 1] : null;
  const mockLabel = lastMock != null ? `${lastMock}%` : '—';
  const confWord = CONFIDENCE_WORDS[confidence] || 'Steady';

  const handleToggleTopic = (topicId: string) => {
    if (!exam) return;
    toggleExamTopic(exam.id, topicId).catch((err) => {
      console.error('[CertTracker] failed to toggle topic', err);
    });
  };

  const handleLogPractice = async () => {
    const count = parseInt(practiceInputValue, 10);
    if (!exam || !Number.isFinite(count) || count <= 0) return;
    setSavingPractice(true);
    try {
      await logExamPractice(exam.id, count);
      setPracticeInputValue('');
      setPracticeInputOpen(false);
    } catch (err) {
      console.error('[CertTracker] failed to log practice questions', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSavingPractice(false);
    }
  };

  const handleAddMockScore = async () => {
    const score = parseInt(mockInputValue, 10);
    if (!exam || !Number.isFinite(score) || score < 0 || score > 100) return;
    setSavingMock(true);
    try {
      await logExamMockScore(exam.id, score);
      setMockInputValue('');
      setMockInputOpen(false);
    } catch (err) {
      console.error('[CertTracker] failed to log mock score', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSavingMock(false);
    }
  };

  const handleSetConfidence = (n: number) => {
    if (!exam || n === confidence) return;
    setExamConfidence(exam.id, n).catch((err) => {
      console.error('[CertTracker] failed to set confidence', err);
    });
  };

  if (!exam) {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
        <BackButton />
        <PageHeader title="No exam yet" titleSize={25} />
        <Text style={[styles.emptyText, { paddingHorizontal: Spacing.md }]}>
          Add an exam from the dashboard to start tracking progress.
        </Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title={`${exam.name} progress`} titleSize={25} />

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
          <AnimatedProgressBar pct={certPct} color={Colors.white} />
        </View>
      </LinearGradient>

      <Text style={styles.eyebrow}>TOPICS</Text>
      {topics.length > 0 ? (
        <View style={styles.topicsList}>
          {topics.map((topic) => (
            <Pressable key={topic.id} style={styles.topicRow} onPress={() => handleToggleTopic(topic.id)}>
              <View
                style={[
                  styles.topicCheckbox,
                  topic.done
                    ? { backgroundColor: '#8B3FD1' }
                    : { borderWidth: 1.9, borderColor: Colors.border },
                ]}
              >
                {topic.done && <IconSymbol name="checkmark" color={Colors.white} size={13} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.topicText}>{topic.title}</Text>
                <Text style={styles.topicWeek}>Week {topic.week}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { paddingHorizontal: Spacing.md }]}>
          No study topics generated for this exam yet.
        </Text>
      )}

      <View style={styles.statsRow}>
        <StatCard label="Practice questions" style={styles.statCard}>
          <Text style={styles.statValue}>{practiceLogged}</Text>
          {practiceInputOpen ? (
            <View style={styles.inlineInputRow}>
              <TextInput
                value={practiceInputValue}
                onChangeText={setPracticeInputValue}
                placeholder="Count"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={styles.inlineInput}
                autoFocus
                onSubmitEditing={handleLogPractice}
              />
              <Pressable
                style={[
                  styles.inlineConfirmBtn,
                  (!practiceInputValue || savingPractice) && styles.inlineConfirmBtnDisabled,
                ]}
                onPress={handleLogPractice}
                disabled={!practiceInputValue || savingPractice}
              >
                <Text style={styles.inlineConfirmText}>{savingPractice ? '…' : 'Add'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.statButton} onPress={() => setPracticeInputOpen(true)}>
              <Text style={styles.statButtonText}>+ Log questions</Text>
            </Pressable>
          )}
        </StatCard>
        <StatCard label="Last mock exam" style={styles.statCard}>
          <Text style={styles.statValue}>{mockLabel}</Text>
          {mockInputOpen ? (
            <View style={styles.inlineInputRow}>
              <TextInput
                value={mockInputValue}
                onChangeText={setMockInputValue}
                placeholder="0-100"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={3}
                style={styles.inlineInput}
                autoFocus
                onSubmitEditing={handleAddMockScore}
              />
              <Pressable
                style={[
                  styles.inlineConfirmBtn,
                  (!mockInputValue || savingMock) && styles.inlineConfirmBtnDisabled,
                ]}
                onPress={handleAddMockScore}
                disabled={!mockInputValue || savingMock}
              >
                <Text style={styles.inlineConfirmText}>{savingMock ? '…' : 'Save'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.statButton} onPress={() => setMockInputOpen(true)}>
              <Text style={styles.statButtonText}>+ Add score</Text>
            </Pressable>
          )}
        </StatCard>
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
              onPress={() => handleSetConfidence(n)}
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
  emptyText: {
    fontSize: 13.5,
    color: Colors.textMuted,
    marginTop: 8,
    lineHeight: 19,
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
  topicWeek: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
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
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },
  inlineConfirmBtn: {
    backgroundColor: '#8B3FD1',
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineConfirmBtnDisabled: {
    opacity: 0.5,
  },
  inlineConfirmText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.white,
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
