import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TaskCategories } from '@/constants/taskMeta';
import { goalService } from '@/services/goal.service';
import type { Goal, GoalTypeId, NewGoalInput } from '@/types/goal.types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const GOAL_TYPES: { id: GoalTypeId; label: string; color: string }[] = [
  { id: 'study', label: 'Study', color: Colors.primaryLight },
  { id: 'career', label: 'Career', color: TaskCategories.career.color },
  { id: 'personal', label: 'Personal', color: TaskCategories.personal.color },
  { id: 'habit', label: 'Habit', color: TaskCategories.habit.color },
];

interface DraftMilestone {
  key: string;
  title: string;
  dueLabel: string;
}

type Step = 'form' | 'generating' | 'review';

interface CareerGoalFields {
  targetRole?: string;
  targetIndustry?: string;
  targetDate?: string;
}

interface NewGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: NewGoalInput) => Promise<void>;
  editingGoal?: Goal | null;
  onSave?: (
    id: string,
    patch: { title: string; type: GoalTypeId; tag: string; color: string } & CareerGoalFields
  ) => Promise<void>;
}

export function NewGoalModal({ visible, onClose, onCreate, editingGoal, onSave }: NewGoalModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [goalType, setGoalType] = useState<GoalTypeId>('study');
  const [goalName, setGoalName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [milestones, setMilestones] = useState<DraftMilestone[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canGenerate = goalName.trim().length > 0;

  const reset = () => {
    setStep('form');
    setGoalType('study');
    setGoalName('');
    setTargetRole('');
    setTargetIndustry('');
    setTargetDate(null);
    setMilestones([]);
    setSubmitting(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (editingGoal) {
      setGoalType(editingGoal.type);
      setGoalName(editingGoal.title);
      setTargetRole(editingGoal.targetRole ?? '');
      setTargetIndustry(editingGoal.targetIndustry ?? '');
      setTargetDate(editingGoal.targetDate ? new Date(editingGoal.targetDate) : null);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingGoal]);

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleSaveEdit = async () => {
    if (!editingGoal || !onSave || !canGenerate) return;
    const type = GOAL_TYPES.find((t) => t.id === goalType)!;
    setSubmitting(true);
    try {
      await onSave(editingGoal.id, {
        title: goalName.trim(),
        type: type.id,
        tag: type.label,
        color: type.color,
        targetDate: targetDate ? targetDate.toISOString() : '',
        ...(type.id === 'career'
          ? { targetRole: targetRole.trim(), targetIndustry: targetIndustry.trim() }
          : {}),
      });
      handleClose();
    } catch (err) {
      console.error('[NewGoalModal] failed to save goal', err);
      Alert.alert("Couldn't save goal", 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStep('generating');
    try {
      const { milestones: suggestions } = await goalService.generateMilestones({
        title: goalName.trim(),
        type: goalType,
      });
      setMilestones(
        suggestions.map((s, i) => ({ key: `gen-${i}`, title: s.title, dueLabel: s.dueLabel }))
      );
      setStep('review');
    } catch (err) {
      console.error('[NewGoalModal] failed to generate milestones', err);
      Alert.alert("Couldn't generate milestones", 'Check your connection and try again.');
      setStep('form');
    }
  };

  const updateMilestone = (key: string, patch: Partial<DraftMilestone>) => {
    setMilestones((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };

  const removeMilestone = (key: string) => {
    setMilestones((prev) => prev.filter((m) => m.key !== key));
  };

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { key: `custom-${Date.now()}`, title: '', dueLabel: '' }]);
  };

  const handleCreate = async () => {
    const type = GOAL_TYPES.find((t) => t.id === goalType)!;
    setSubmitting(true);
    try {
      await onCreate({
        type: type.id,
        tag: type.label,
        title: goalName.trim(),
        color: type.color,
        milestones: milestones
          .filter((m) => m.title.trim().length > 0)
          .map((m) => ({ title: m.title.trim(), dueLabel: m.dueLabel.trim() })),
        targetDate: targetDate ? targetDate.toISOString() : '',
        ...(type.id === 'career'
          ? { targetRole: targetRole.trim(), targetIndustry: targetIndustry.trim() }
          : {}),
      });
      handleClose();
    } catch (err) {
      console.error('[NewGoalModal] failed to create goal', err);
      Alert.alert("Couldn't create goal", 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={85}>
        {step === 'form' && (
          <>
            <Text style={styles.sheetTitle}>{editingGoal ? 'Edit goal' : 'New goal'}</Text>

            <Text style={styles.sheetEyebrow}>Type</Text>
            <View style={styles.typeRow}>
              {GOAL_TYPES.map((t) => {
                const on = goalType === t.id;
                return (
                  <Pressable
                    key={t.id}
                    style={[
                      styles.typeChip,
                      { backgroundColor: on ? t.color : Colors.white, borderColor: on ? t.color : Colors.border },
                    ]}
                    onPress={() => setGoalType(t.id)}
                  >
                    <Text style={[styles.typeChipText, { color: on ? Colors.white : Colors.textSecondary }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="Name your goal (e.g. Finish CFA Level I)"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />

            {goalType === 'career' && (
              <>
                <TextInput
                  value={targetRole}
                  onChangeText={setTargetRole}
                  placeholder="Target role (e.g. Senior Product Manager)"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={targetIndustry}
                  onChangeText={setTargetIndustry}
                  placeholder="Target industry (e.g. Fintech)"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />
              </>
            )}

            <Pressable style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerIcon}>📅</Text>
              <Text style={[styles.datePickerText, !targetDate && styles.datePickerPlaceholder]}>
                {targetDate ? formatDate(targetDate) : 'Due date (optional)'}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={targetDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="light"
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (date) setTargetDate(date);
                }}
              />
            )}

            <Pressable
              style={[styles.primaryButton, (!canGenerate || submitting) && styles.primaryButtonDisabled]}
              disabled={!canGenerate || submitting}
              onPress={editingGoal ? handleSaveEdit : handleGenerate}
            >
              <Text style={[styles.primaryButtonText, (!canGenerate || submitting) && styles.primaryButtonTextDisabled]}>
                {editingGoal ? (submitting ? 'Saving…' : 'Save changes') : 'Generate plan'}
              </Text>
            </Pressable>
          </>
        )}

        {step === 'generating' && (
          <View style={styles.generatingBox}>
            <ActivityIndicator color={Colors.primaryLight} size="large" />
            <Text style={styles.generatingText}>Generating milestones…</Text>
          </View>
        )}

        {step === 'review' && (
          <>
            <Text style={styles.sheetTitle}>Review milestones</Text>
            <Text style={styles.sheetSub}>Edit, remove, or add to the plan before saving.</Text>

            <ScrollView style={styles.milestoneList} keyboardShouldPersistTaps="handled">
              {milestones.map((m) => (
                <View key={m.key} style={styles.milestoneRow}>
                  <View style={styles.milestoneInputs}>
                    <TextInput
                      value={m.title}
                      onChangeText={(text) => updateMilestone(m.key, { title: text })}
                      placeholder="Milestone"
                      placeholderTextColor={Colors.textMuted}
                      style={styles.milestoneTitleInput}
                    />
                    <TextInput
                      value={m.dueLabel}
                      onChangeText={(text) => updateMilestone(m.key, { dueLabel: text })}
                      placeholder="When? (e.g. This month)"
                      placeholderTextColor={Colors.textMuted}
                      style={styles.milestoneDueInput}
                    />
                  </View>
                  <Pressable onPress={() => removeMilestone(m.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.addMilestoneButton} onPress={addMilestone}>
                <Text style={styles.addMilestoneText}>+ Add milestone</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.reviewFooter}>
              <Pressable style={styles.backButton} onPress={() => setStep('form')} disabled={submitting}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.reviewCreateButton, submitting && styles.primaryButtonDisabled]}
                disabled={submitting}
                onPress={handleCreate}
              >
                <Text style={styles.primaryButtonText}>{submitting ? 'Creating…' : 'Create goal'}</Text>
              </Pressable>
            </View>
          </>
        )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  datePicker: {
    marginTop: 16,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  datePickerIcon: {
    fontSize: 16,
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  datePickerPlaceholder: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.border,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryButtonTextDisabled: {
    color: Colors.textMuted,
  },
  generatingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  generatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  milestoneList: {
    marginTop: 14,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
  },
  milestoneInputs: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  milestoneTitleInput: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
  },
  milestoneDueInput: {
    fontSize: 12.5,
    color: Colors.textMuted,
    padding: 0,
  },
  removeText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },
  addMilestoneButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addMilestoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  reviewFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  reviewCreateButton: {
    flex: 1,
    marginTop: 0,
  },
});
