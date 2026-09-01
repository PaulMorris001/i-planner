import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Alert, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, monthlySavingsAmount } from '@/utils/currency';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatDatePickerLabel, parseISODateLocal, toDateKey } from '@/utils/date';
import type { SavingsGoal, NewSavingsGoalInput } from '@/types/savingsGoal.types';

const TARGET_STEP = 100;
const SAVED_STEP = 50;
const AMOUNT_MIN = 0;
const DEFAULT_TARGET = 2000;

type Step = 'disclaimer' | 'form';

interface SavingsGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: NewSavingsGoalInput) => Promise<void>;
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
  // Raw text mirrors of the two amounts, for the typeable fields below — kept
  // separate so a mid-typing state like "" or a leading-zero string doesn't
  // get clobbered by re-deriving it from the numeric value on every keystroke.
  const [targetAmountText, setTargetAmountText] = useState(String(DEFAULT_TARGET));
  const [savedAmountText, setSavedAmountText] = useState('0');
  const [targetDate, setTargetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setTargetAmount(DEFAULT_TARGET);
    setSavedAmount(0);
    setTargetAmountText(String(DEFAULT_TARGET));
    setSavedAmountText('0');
    setTargetDate(new Date());
  };

  // Shared by both the stepper buttons and the typed field for each amount —
  // keeps the two in sync so each always reflects the other's latest edit.
  const applyTargetAmount = (next: number) => {
    const clamped = Math.max(AMOUNT_MIN, next);
    setTargetAmount(clamped);
    setTargetAmountText(String(clamped));
  };
  const applySavedAmount = (next: number) => {
    const clamped = Math.max(AMOUNT_MIN, next);
    setSavedAmount(clamped);
    setSavedAmountText(String(clamped));
  };
  const handleTargetAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setTargetAmountText(digits);
    setTargetAmount(digits === '' ? AMOUNT_MIN : Math.max(AMOUNT_MIN, Number(digits)));
  };
  const handleSavedAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setSavedAmountText(digits);
    setSavedAmount(digits === '' ? AMOUNT_MIN : Math.max(AMOUNT_MIN, Number(digits)));
  };
  // On blur, drop a stray "" or leading zeros back to the clean numeric value.
  const handleTargetAmountBlur = () => setTargetAmountText(String(targetAmount));
  const handleSavedAmountBlur = () => setSavedAmountText(String(savedAmount));

  useEffect(() => {
    if (!visible) return;
    setStep(savingsDisclosureAcknowledged ? 'form' : 'disclaimer');
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmount(editingGoal.targetAmount);
      setSavedAmount(editingGoal.savedAmount);
      setTargetAmountText(String(editingGoal.targetAmount));
      setSavedAmountText(String(editingGoal.savedAmount));
      setTargetDate(editingGoal.targetDate ? parseISODateLocal(editingGoal.targetDate) : new Date());
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
  const monthlyAmount = monthlySavingsAmount(targetAmount, savedAmount, toDateKey(targetDate));

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), targetAmount, savedAmount, targetDate: toDateKey(targetDate) });
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
              <View style={styles.amountInputRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  value={targetAmountText}
                  onChangeText={handleTargetAmountChange}
                  onBlur={handleTargetAmountBlur}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.amountInput}
                />
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepperBtn} onPress={() => applyTargetAmount(targetAmount - TARGET_STEP)}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.stepperBtn} onPress={() => applyTargetAmount(targetAmount + TARGET_STEP)}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.stepperBox}>
            <Text style={styles.stepperLabel}>Already saved</Text>
            <View style={styles.stepperValueRow}>
              <View style={styles.amountInputRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  value={savedAmountText}
                  onChangeText={handleSavedAmountChange}
                  onBlur={handleSavedAmountBlur}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.amountInput}
                />
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepperBtn} onPress={() => applySavedAmount(savedAmount - SAVED_STEP)}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.stepperBtn} onPress={() => applySavedAmount(savedAmount + SAVED_STEP)}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.sheetEyebrow}>Target date</Text>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
            <Text style={styles.datePickerIcon}>📅</Text>
            <Text style={styles.datePickerText}>{formatDatePickerLabel(targetDate)}</Text>
          </TouchableOpacity>
          <InlineDateTimePicker
            visible={showDatePicker}
            value={targetDate}
            mode="date"
            onChange={setTargetDate}
            onDismiss={() => setShowDatePicker(false)}
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
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 9,
  },
  datePicker: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '600' },
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
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountPrefix: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountInput: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    padding: 0,
    minWidth: 40,
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
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
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
