import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Radius } from '@/constants/theme';
import { formatCurrency } from '@/utils/currency';
import type { SavingsGoal } from '@/types/settings.types';

const ADD_STEP = 50;
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setAmount(DEFAULT_ADD);
  }, [visible]);

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
        <Pressable style={styles.stepperBtn} onPress={() => setAmount((a) => Math.max(0, a - ADD_STEP))}>
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>
        <Text style={styles.amountText}>{formatCurrency(amount)}</Text>
        <Pressable style={styles.stepperBtn} onPress={() => setAmount((a) => a + ADD_STEP)}>
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
  amountText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
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
