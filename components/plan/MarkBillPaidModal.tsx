import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius } from '@/constants/theme';
import { formatCurrency } from '@/utils/currency';
import { formatShortDate } from '@/utils/date';
import type { Bill } from '@/types/bill.types';

interface MarkBillPaidModalProps {
  visible: boolean;
  onClose: () => void;
  bill: Bill | null;
  // The already-computed due date of the cycle this prompt is for (today's
  // upcoming occurrence for a recurring bill, or the bill's own date for a
  // one-time one) — computing it is the caller's job (BillRemindersSection
  // already does this for display), not this modal's.
  cycleDueDateKey: string | null;
  onMarkPaid: () => Promise<void>;
  onEdit: () => void;
}

// Tapping a bill opens this instead of the edit form directly — "Edit bill
// instead" is the escape hatch for someone who tapped meaning to edit.
export function MarkBillPaidModal({ visible, onClose, bill, cycleDueDateKey, onMarkPaid, onEdit }: MarkBillPaidModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!bill) return null;

  const handleMarkPaid = async () => {
    setSubmitting(true);
    try {
      await onMarkPaid();
      onClose();
    } catch (err) {
      console.error('[MarkBillPaidModal] failed to mark bill paid', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <View style={{ width: 34 }} />
        <ModalCloseButton onPress={onClose} />
      </View>

      <View style={styles.iconBadge}>
        <IconSymbol name="checkmark" color={Colors.success} size={26} />
      </View>
      <Text style={styles.title}>Mark as paid?</Text>
      <Text style={styles.subtitle}>
        {bill.name} · {formatCurrency(bill.amount)}
        {cycleDueDateKey ? ` · ${formatShortDate(cycleDueDateKey)}` : ''}
      </Text>

      <Pressable style={styles.primaryBtn} onPress={handleMarkPaid} disabled={submitting}>
        <Text style={styles.primaryBtnText}>{submitting ? 'Marking…' : 'Mark as paid'}</Text>
      </Pressable>

      <Pressable style={styles.editBtn} onPress={handleEdit} disabled={submitting}>
        <Text style={styles.editBtnText}>Edit bill instead</Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  iconBadge: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  editBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
