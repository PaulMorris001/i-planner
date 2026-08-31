import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { Chip } from '@/components/ui/Chip';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { formatCurrency } from '@/utils/currency';
import { formatDatePickerLabel, parseISODateLocal, toDateKey } from '@/utils/date';
import { confirmDelete } from '@/utils/confirmDelete';
import type { Bill, BillCategory, NewBillInput } from '@/types/bill.types';

const AMOUNT_STEP = 10;
const AMOUNT_MIN = 0;
const DEFAULT_AMOUNT = 50;

const CATEGORY_OPTIONS: { key: BillCategory; label: string }[] = [
  { key: 'housing', label: 'Housing' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'loans', label: 'Loans' },
  { key: 'other', label: 'Other' },
];

interface AddBillModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: NewBillInput) => Promise<void>;
  onRemove?: () => Promise<void>;
  editingBill?: Bill | null;
}

export function AddBillModal({ visible, onClose, onSave, onRemove, editingBill }: AddBillModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [category, setCategory] = useState<BillCategory>('other');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setAmount(DEFAULT_AMOUNT);
    setDueDate(new Date());
    setRecurring(false);
    setCategory('other');
  };

  useEffect(() => {
    if (!visible) return;
    if (editingBill) {
      setName(editingBill.name);
      setAmount(editingBill.amount);
      setDueDate(parseISODateLocal(editingBill.dueDate));
      setRecurring(editingBill.recurring);
      setCategory(editingBill.category);
    } else {
      reset();
    }
  }, [visible, editingBill]);

  const handleClose = () => {
    onClose();
    reset();
  };

  const canSave = name.trim().length > 0 && amount > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), amount, dueDate: toDateKey(dueDate), recurring, category });
      handleClose();
    } catch (err) {
      console.error('[AddBillModal] failed to save bill', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    if (!onRemove) return;
    confirmDelete(name || 'this bill', () => {
      onRemove()
        .then(handleClose)
        .catch((err) => console.error('[AddBillModal] failed to remove bill', err));
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={90}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>{editingBill ? 'Edit bill' : 'Add a bill'}</Text>
          <ModalCloseButton onPress={handleClose} />
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bill name (e.g. Rent)"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />

        <View style={styles.stepperBox}>
          <Text style={styles.stepperLabel}>Amount</Text>
          <View style={styles.stepperValueRow}>
            <Text style={styles.stepperAmount}>{formatCurrency(amount)}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => setAmount(Math.max(AMOUNT_MIN, amount - AMOUNT_STEP))}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Pressable style={styles.stepperBtn} onPress={() => setAmount(amount + AMOUNT_STEP)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.sheetEyebrow}>Due date</Text>
        <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
          <Text style={styles.datePickerIcon}>📅</Text>
          <Text style={styles.datePickerText}>{formatDatePickerLabel(dueDate)}</Text>
        </TouchableOpacity>
        <InlineDateTimePicker
          visible={showDatePicker}
          value={dueDate}
          mode="date"
          onChange={setDueDate}
          onDismiss={() => setShowDatePicker(false)}
        />

        <View style={styles.recurringRow}>
          <View>
            <Text style={styles.recurringTitle}>Recurring monthly</Text>
            <Text style={styles.recurringSub}>This bill repeats every month</Text>
          </View>
          <TouchableOpacity onPress={() => setRecurring((p) => !p)} activeOpacity={0.8}>
            <View style={[styles.toggle, recurring && styles.toggleActive]}>
              <View style={[styles.toggleThumb, recurring && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetEyebrow}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              selected={category === c.key}
              onPress={() => setCategory(c.key)}
              activeColor={Colors.warning}
              size="compact"
            />
          ))}
        </View>

        <View style={styles.hintBox}>
          <IconSymbol name="bell.fill" color={Colors.warning} size={14} />
          <Text style={styles.hintText}>You&apos;ll be reminded 3 days before and on the due date.</Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
            {submitting ? 'Saving…' : editingBill ? 'Save changes' : 'Add bill reminder'}
          </Text>
        </Pressable>

        {!!editingBill && !!onRemove && (
          <Pressable style={styles.removeBtn} onPress={handleRemove}>
            <Text style={styles.removeBtnText}>Remove bill</Text>
          </Pressable>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
  datePicker: {
    height: 48,
    borderRadius: Radius.md,
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
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 13,
    paddingHorizontal: 15,
    marginTop: 16,
  },
  recurringTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  recurringSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.warningSoft,
    borderRadius: 13,
    padding: 14,
    marginTop: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.warning,
    lineHeight: 18,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.warning,
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
