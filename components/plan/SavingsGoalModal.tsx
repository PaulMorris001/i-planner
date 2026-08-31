import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, monthlySavingsAmount } from '@/utils/currency';
import { confirmDelete } from '@/utils/confirmDelete';
import type { SavingsGoal } from '@/types/settings.types';

const TARGET_STEP = 100;
const SAVED_STEP = 50;
const AMOUNT_MIN = 0;
const DEFAULT_TARGET = 2000;

type Step = 'disclaimer' | 'form';

interface SavingsGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: SavingsGoal) => Promise<void>;
  onRemove?: () => Promise<void>;
  editingGoal: SavingsGoal | null;
}

export function SavingsGoalModal({ visible, onClose, onSave, onRemove, editingGoal }: SavingsGoalModalProps) {
  const { savingsDisclosureAcknowledged, acknowledgeSavingsDisclosure } = useSettings();
  const [step, setStep] = useState<Step>('form');
  const [agreeing, setAgreeing] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(DEFAULT_TARGET);
  const [savedAmount, setSavedAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setTargetAmount(DEFAULT_TARGET);
    setSavedAmount(0);
    setTargetDate('');
  };

  useEffect(() => {
    if (!visible) return;
    setStep(savingsDisclosureAcknowledged ? 'form' : 'disclaimer');
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmount(editingGoal.targetAmount);
      setSavedAmount(editingGoal.savedAmount);
      setTargetDate(editingGoal.targetDate);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingGoal]);

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleAgree = async () => {
    setAgreeing(true);
    const ok = await acknowledgeSavingsDisclosure();
    setAgreeing(false);
    if (ok) {
      setStep('form');
    } else {
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    }
  };

  const canSave = name.trim().length > 0 && targetAmount > 0 && !submitting;
  const monthlyAmount = monthlySavingsAmount(targetAmount, savedAmount, targetDate);

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), targetAmount, savedAmount, targetDate: targetDate.trim() });
      handleClose();
    } catch (err) {
      console.error('[SavingsGoalModal] failed to save savings goal', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    if (!onRemove) return;
    confirmDelete(name || 'this goal', () => {
      onRemove()
        .then(handleClose)
        .catch((err) => console.error('[SavingsGoalModal] failed to remove savings goal', err));
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={88}>
      {step === 'disclaimer' ? (
        <View style={styles.disclaimerWrap}>
          <View style={styles.iconBadge}>
            <IconSymbol name="info.circle" color={Colors.warning} size={26} />
          </View>
          <Text style={styles.disclaimerTitle}>A quick note on financial goals</Text>
          <Text style={styles.disclaimerBody}>
            I-Planner helps you plan and track savings, but it is not a licensed financial advisor. All
            figures and monthly targets are estimates for guidance only — not financial advice.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleAgree} disabled={agreeing}>
            <Text style={styles.primaryBtnText}>{agreeing ? 'Saving…' : 'I understand — continue'}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Text style={styles.title}>{editingGoal ? 'Edit savings goal' : 'New savings goal'}</Text>
            <ModalCloseButton onPress={handleClose} />
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Goal name (e.g. House deposit)"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <View style={styles.stepperBox}>
            <Text style={styles.stepperLabel}>Target amount</Text>
            <View style={styles.stepperValueRow}>
              <Text style={styles.stepperAmount}>{formatCurrency(targetAmount)}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => setTargetAmount(Math.max(AMOUNT_MIN, targetAmount - TARGET_STEP))}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.stepperBtn} onPress={() => setTargetAmount(targetAmount + TARGET_STEP)}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.stepperBox}>
            <Text style={styles.stepperLabel}>Already saved</Text>
            <View style={styles.stepperValueRow}>
              <Text style={styles.stepperAmount}>{formatCurrency(savedAmount)}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => setSavedAmount(Math.max(AMOUNT_MIN, savedAmount - SAVED_STEP))}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.stepperBtn} onPress={() => setSavedAmount(savedAmount + SAVED_STEP)}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="Target date (e.g. Jun 2027)"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          {monthlyAmount !== null && (
            <View style={styles.hintBox}>
              <IconSymbol name="info.circle" color={Colors.warning} size={16} />
              <Text style={styles.hintText}>
                Set aside <Text style={styles.hintBold}>{formatCurrency(monthlyAmount)}/mo</Text> to reach your goal.
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
              {submitting ? 'Saving…' : editingGoal ? 'Save changes' : 'Create savings goal'}
            </Text>
          </Pressable>

          {!!editingGoal && !!onRemove && (
            <Pressable style={styles.removeBtn} onPress={handleRemove}>
              <Text style={styles.removeBtnText}>Remove savings goal</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // Disclaimer step
  disclaimerWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  disclaimerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  disclaimerBody: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: Spacing.lg,
  },
  // Form step
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 10,
  },
  input: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  stepperBox: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    backgroundColor: Colors.white,
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperAmount: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.warningSoft,
    borderRadius: 13,
    padding: 14,
    marginTop: 14,
  },
  hintText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: Colors.warning,
    lineHeight: 19,
  },
  hintBold: {
    fontWeight: '700',
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.border,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryBtnTextDisabled: {
    color: Colors.textMuted,
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  removeBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.error,
  },
});
