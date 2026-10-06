import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { StudySessionSheet } from '@/components/study/StudySessionSheet';
import { BackButton } from '@/components/ui/BackButton';
import { requestConfirm } from '@/components/ui/ConfirmModal';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { useStudy } from '@/hooks/useStudy';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatClock, formatStudyDuration, scheduleLabel } from '@/utils/studyFormat';
import type { NewStudySessionInput, StudySession } from '@/types/study.types';

// Study time for students and exam candidates: reusable study sessions, a timer that
// can be paused for breaks, and the hours it adds up to (this week and all time).
// Only time between Start and Stop counts, and it is timed by the server.
export default function Study() {
  const study = useStudy();
  const sheet = useEditableSheet<StudySession>();
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await study.reload();
    } finally {
      setRefreshing(false);
    }
  };

  const showError = (title: string, err: unknown) => {
    console.error(`[Study] ${title}`, err);
    Alert.alert(title, err instanceof Error ? err.message : 'Please try again.');
  };

  const handleStart = async (session: StudySession) => {
    try {
      await study.start(session);
    } catch (err) {
      showError("Couldn't start", err);
      study.reload();
    }
  };

  const handlePauseResume = async () => {
    try {
      if (study.current?.status === 'paused') await study.resume();
      else await study.pause();
    } catch (err) {
      showError('Something went wrong', err);
      study.reload();
    }
  };

  const doStop = async () => {
    try {
      const result = await study.stop();
      if (!result) return;
      if (!result.logged) {
        Alert.alert('Not logged', 'Sessions under 10 minutes of study time are not logged.');
      } else {
        const earned = result.points > 0 ? ` You earned ${result.points} points.` : '';
        Alert.alert('Session logged', `${formatStudyDuration(result.minutes * 60_000)} of study time.${earned}`);
      }
    } catch (err) {
      showError("Couldn't stop", err);
      study.reload();
    }
  };

  const handleStop = () => {
    requestConfirm({
      title: 'Stop and log this session?',
      message: `${formatClock(study.elapsedMs)} of study time so far.`,
      confirmLabel: 'Stop',
      destructive: false,
      onConfirm: doStop,
    });
  };

  const handleSave = async (input: NewStudySessionInput) => {
    setSaving(true);
    try {
      if (sheet.editing) await study.updateSession(sheet.editing.id, input);
      else await study.createSession(input);
      sheet.close();
    } catch (err) {
      showError("Couldn't save", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (session: StudySession) => {
    sheet.close();
    confirmDelete(session.name, () => {
      study.removeSession(session.id).catch((err) => showError("Couldn't delete", err));
    }, 'Hours you already logged stay in your totals.');
  };

  const current = study.current;
  const paused = current?.status === 'paused';

  return (
    <ScreenWrapper
      backgroundColor={Colors.offWhite}
      scroll
      style={styles.scrollContent}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <BackButton />
      <PageHeader title="Study time" subtitle="Only the time you spend studying is counted." />

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatStudyDuration(study.stats.weekMs)}</Text>
            <Text style={styles.statLabel}>This week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatStudyDuration(study.stats.allTimeMs)}</Text>
            <Text style={styles.statLabel}>All time</Text>
          </View>
        </View>

        {current && (
          <View style={styles.activeCard}>
            <Text style={styles.activeEyebrow}>{paused ? 'PAUSED' : 'STUDYING NOW'}</Text>
            <Text style={styles.activeName} numberOfLines={1}>
              {current.sessionName}
            </Text>
            <Text style={[styles.clock, paused && styles.clockPaused]}>{formatClock(study.elapsedMs)}</Text>
            <Text style={styles.activeHint}>
              {paused ? 'The timer is on hold. Break time is not counted.' : 'Every full 30 minutes earns points.'}
            </Text>
            <View style={styles.activeButtons}>
              <Pressable style={styles.pauseButton} onPress={handlePauseResume} disabled={study.busy}>
                <Text style={styles.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
              </Pressable>
              <Pressable style={styles.stopButton} onPress={handleStop} disabled={study.busy}>
                {study.busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.stopText}>Stop</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.eyebrow}>YOUR STUDY SESSIONS</Text>
        <Text style={styles.sectionDesc}>
          Create a session once and start it whenever you study, as many times a week as you like.
        </Text>

        {!study.loaded ? (
          <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 16 }} />
        ) : study.failed && study.sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>Couldn&apos;t load your study sessions.</Text>
            <Pressable onPress={study.reload} hitSlop={8}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          study.sessions.map((session) => {
            const isRunning = current?.sessionId === session.id;
            return (
              <Pressable key={session.id} style={styles.sessionCard} onPress={() => sheet.openEdit(session)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName} numberOfLines={1}>
                    {session.name}
                  </Text>
                  <Text style={styles.sessionMeta}>{scheduleLabel(session)}</Text>
                </View>
                <Pressable
                  style={[styles.startButton, (!!current || study.busy) && styles.startButtonDisabled]}
                  onPress={() => handleStart(session)}
                  disabled={!!current || study.busy}
                  hitSlop={6}
                >
                  <Text style={[styles.startText, (!!current || study.busy) && styles.startTextDisabled]}>
                    {isRunning ? 'Running' : 'Start'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })
        )}

        <View style={{ marginTop: 12 }}>
          <DashedAddButton label="New study session" onPress={sheet.openNew} />
        </View>
      </View>

      <StudySessionSheet
        visible={sheet.open}
        onClose={sheet.close}
        editing={sheet.editing}
        saving={saving}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  body: { paddingHorizontal: Spacing.md },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  activeCard: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  activeEyebrow: { fontSize: 12, fontWeight: '700', color: Colors.primaryLight, letterSpacing: 0.5 },
  activeName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 4, maxWidth: '100%' },
  clock: { fontSize: 46, fontWeight: '800', color: Colors.textPrimary, marginTop: 6, fontVariant: ['tabular-nums'] },
  clockPaused: { color: Colors.textMuted },
  activeHint: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  activeButtons: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  pauseButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  pauseText: { fontSize: 15, fontWeight: '700', color: Colors.primaryLight },
  stopButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.error,
  },
  stopText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 11 },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
  },
  empty: { fontSize: 13, color: Colors.textSecondary },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight, paddingVertical: 6 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  sessionName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sessionMeta: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  startButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  startButtonDisabled: { backgroundColor: Colors.border },
  startText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  startTextDisabled: { color: Colors.textMuted },
});
