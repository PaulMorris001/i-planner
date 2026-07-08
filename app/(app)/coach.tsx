import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Colors, Spacing } from '@/constants/theme';

interface Attachment {
  uri: string;
  name: string;
}

type CoachModeId = 'study' | 'plan' | 'goal';

const MODES: { id: CoachModeId; label: string }[] = [
  { id: 'study', label: 'Study Buddy' },
  { id: 'plan', label: 'Plan My Day' },
  { id: 'goal', label: 'Goal Coach' },
];

const EMPTY_STATE: Record<CoachModeId, { title: string; desc: string }> = {
  study: { title: 'Study Buddy', desc: 'Ask a question, drop in your notes, or get quizzed on any topic.' },
  plan: { title: 'Plan My Day', desc: "I'll turn your tasks, deadlines and calendar into a focused daily schedule." },
  goal: { title: 'Goal Coach', desc: "Tell me a goal and a target date — I'll break it into milestones and a first step." },
};

const SUGGESTIONS: Record<CoachModeId, string[]> = {
  study: ['Quiz me on Week 1 topics', 'Explain a concept simply', 'Summarize my last upload'],
  plan: ['Plan my day', 'What should I focus on?', 'Reschedule around my class'],
  goal: ['Set a study goal this week', 'Set a savings goal', 'Break down my exam prep', 'Suggest a habit'],
};

const AI_FREE_LIMIT = 5;
const AI_QUERIES_USED = 4;

export default function Coach() {
  const { focusProfile } = useOnboarding();
  const [modeOverride, setModeOverride] = useState<CoachModeId | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const visibleModes = MODES.filter((m) => m.id !== 'study' || focusProfile !== 'professional');
  const mode = modeOverride && visibleModes.some((m) => m.id === modeOverride) ? modeOverride : visibleModes[0].id;

  const empty = EMPTY_STATE[mode];

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setAttachments((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, name: a.name })),
    ]);
  };

  const removeAttachment = (uri: string) => {
    setAttachments((prev) => prev.filter((a) => a.uri !== uri));
  };

  const handleSend = () => {
    setInput('');
    setAttachments([]);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.root}>
        <View style={styles.headerArea}>
          <View style={styles.headerRow}>
            <View style={styles.headerIconBox}>
              <IconSymbol name="sparkles" color={Colors.white} size={20} />
            </View>
            <Text style={styles.headerTitle}>AI Coach</Text>
          </View>

          <View style={styles.segmented}>
            {visibleModes.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.segment, mode === m.id && styles.segmentActive]}
                onPress={() => setModeOverride(m.id)}
              >
                <Text style={mode === m.id ? styles.segmentTextActive : styles.segmentText}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptyDesc}>{empty.desc}</Text>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.meterRow}>
            <IconSymbol name="sparkles" color={Colors.textMuted} size={14} />
            <Text style={styles.meterText}>
              {AI_FREE_LIMIT - AI_QUERIES_USED} of {AI_FREE_LIMIT} free AI queries left this week
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {SUGGESTIONS[mode].map((q) => (
              <Pressable key={q} style={styles.chip} onPress={() => setInput(q)}>
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {mode === 'study' && attachments.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {attachments.map((a) => (
                <View key={a.uri} style={styles.fileChip}>
                  <IconSymbol name="doc.fill" color={Colors.primaryLight} size={14} />
                  <Text style={styles.fileChipText} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeAttachment(a.uri)}>
                    <IconSymbol name="xmark" color={Colors.textMuted} size={13} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.inputRow}>
            {mode === 'study' && (
              <Pressable style={styles.attachButton} onPress={handlePickFile}>
                <IconSymbol name="paperclip" color={Colors.textSecondary} size={19} />
              </Pressable>
            )}
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach anything…"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Pressable style={styles.sendButton} onPress={handleSend}>
              <IconSymbol name="arrow.right" color={Colors.white} size={20} />
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerArea: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  segmented: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 20,
    maxWidth: 280,
  },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 14,
    backgroundColor: Colors.offWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 9,
  },
  meterText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipsRow: {
    gap: 7,
    paddingBottom: 9,
  },
  chip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    backgroundColor: Colors.infoSoft,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  fileChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 6,
    paddingLeft: 10,
  },
  attachButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
