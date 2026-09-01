import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Radius } from '@/constants/theme';
import type { SavingsGoal } from '@/types/savingsGoal.types';

const ADD_STEP = 50;
const ADD_MIN = 0;
const DEFAULT_ADD = 100;

interface LogSavingsProgressModalProps {
  visible: boolean;
  onClose: () => void;
  goal: SavingsGoal | null;
  // Receives the full goal with savedAmount already bumped — same shape SavingsGoalModal's
  // onSave takes, so the caller can reuse the same save handler for both.
  onLogProgress: (goal: SavingsGoal) => Promise<void>;
}

// Lightweight, separate from SavingsGoalModal's edit form — logging a contribution is a
// single quick action (bump savedAmount), not editing the whole goal.
export function LogSavingsProgressModal({ visible, onClose, goal, onLogProgress }: LogSavingsProgressModalProps) {
  const [amount, setAmount] = useState(DEFAULT_ADD);
  // Raw text mirror of `amount` for the typeable field below — kept separate
  // so a mid-typing state like "" or a leading-zero string doesn't get
  // clobbered by re-deriving it from the numeric value on every keystroke.
  const [amountText, setAmountText] = useState(String(DEFAULT_ADD));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount(DEFAULT_ADD);
      setAmountText(String(DEFAULT_ADD));
    }
  }, [visible]);

  // Shared by both stepper buttons — keeps amountText in sync so the typed
  // field always reflects the current value after a +/- tap.
  const applyAmount = (next: number) => {
    const clamped = Math.max(ADD_MIN, next);
    setAmount(clamped);
    setAmountText(String(clamped));
  };

  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setAmountText(digits);
    setAmount(digits === '' ? ADD_MIN : Math.max(ADD_MIN, Number(digits)));
  };

  // On blur, drop a stray "" or leading zeros back to the clean numeric value.
  const handleAmountBlur = () => setAmountText(String(amount));

  const handleAdd = async () => {
    if (!goal || amount <= 0) return;
    setSubmitting(true);
    try {
      await onLogProgress({ ...goal, savedAmount: goal.savedAmount + amount });
      onClose();
    } catch (err) {
      console.error('[LogSavingsProgressModal] failed to log progress', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!goal) return null;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Log progress</Text>
      <Text style={styles.subtitle}>How much did you add this time?</Text>

      <View style={styles.stepperRow}>
        <Pressable style={styles.stepperBtn} onPress={() => applyAmount(amount - ADD_STEP)}>
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>
        <View style={styles.amountInputRow}>
          <Text style={styles.amountPrefix}>$</Text>
          <TextInput
            value={amountText}
            onChangeText={handleAmountChange}
            onBlur={handleAmountBlur}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={styles.amountInput}
          />
        </View>
        <Pressable style={styles.stepperBtn} onPress={() => applyAmount(amount + ADD_STEP)}>
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.addBtn, (amount <= 0 || submitting) && styles.addBtnDisabled]}
        onPress={handleAdd}
        disabled={amount <= 0 || submitting}
      >
        <Text style={[styles.addBtnText, (amount <= 0 || submitting) && styles.addBtnTextDisabled]}>
          {submitting ? 'Adding…' : 'Add to savings'}
        </Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: Colors.white,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountPrefix: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountInput: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    padding: 0,
    minWidth: 50,
    textAlign: 'center',
  },
  addBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.warning,
    borderRadius: Radius.md,
    paddingVertical: 15,
  },
  addBtnDisabled: {
    backgroundColor: Colors.border,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  addBtnTextDisabled: {
    color: Colors.textMuted,
  },
});
