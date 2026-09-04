import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ViewMoreToggle } from '@/components/ui/ViewMoreToggle';
import { Colors, Radius } from '@/constants/theme';
import { daysUntil, nextRecurringDueDate, parseISODateLocal, formatShortDate, toDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import { dashboardStyles as styles } from './dashboardStyles';
import type { Bill } from '@/types/bill.types';

interface BillRemindersSectionProps {
  bills: Bill[];
  onAddBill: () => void;
  // Tapping a row — the caller decides what that means (opens the "Mark as
  // paid?" prompt), and gets the already-computed current cycle's date-key
  // alongside the bill so it doesn't have to recompute nextRecurringDueDate.
  onPressBill: (bill: Bill, cycleDueDateKey: string) => void;
  onLongPressBill: (bill: Bill) => void;
}

const PREVIEW_COUNT = 3;
const LEAD_DAYS = 3;

function dueLabel(days: number): string {
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

export function BillRemindersSection({ bills, onAddBill, onPressBill, onLongPressBill }: BillRemindersSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // A recurring bill's stored dueDate never advances — only its day-of-month
  // matters, so the actual next occurrence is computed for both sorting and
  // display (same bug class already fixed for recurring tasks this session).
  const allUpcoming = bills
    .map((bill) => {
      const dueDate = bill.recurring ? nextRecurringDueDate(bill.dueDate) : parseISODateLocal(bill.dueDate);
      const cycleDateKey = toDateKey(dueDate);
      return { bill, dueDate, cycleDateKey, paid: bill.lastPaidCycle === cycleDateKey };
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const upcoming = expanded ? allUpcoming : allUpcoming.slice(0, PREVIEW_COUNT);

  const headerRow = (
    <View style={localStyles.headerRow}>
      <Text style={[styles.eyebrowMuted, localStyles.eyebrowWarning]}>BILL REMINDERS</Text>
      <Pressable style={localStyles.addBtn} onPress={onAddBill}>
        <Text style={localStyles.addBtnText}>+ Add bill</Text>
      </Pressable>
    </View>
  );

  if (upcoming.length === 0) {
    // Same bordered-white-card shell as the Career Goal card above it, instead
    // of floating loose against the page background — keeps every dashboard
    // section reading as its own distinct block regardless of empty/filled state.
    return (
      <Card style={[styles.card, localStyles.section]}>
        {headerRow}
        <EmptyState
          icon="bell.fill"
          title="No bills yet"
          subtitle="Add a bill to get reminded before it's due."
          onPress={onAddBill}
        />
      </Card>
    );
  }

  return (
    <View style={localStyles.section}>
      {headerRow}

      <View style={{ gap: 8, marginTop: 11 }}>
        {upcoming.map(({ bill, dueDate, cycleDateKey, paid }) => {
          const days = daysUntil(dueDate);
          const overdue = !paid && days < 0;
          const dueSoon = !paid && days >= 0 && days <= LEAD_DAYS;
          const tint = paid
            ? { bg: Colors.white, fg: Colors.textMuted }
            : overdue
            ? { bg: Colors.errorBg, fg: Colors.error }
            : dueSoon
            ? { bg: Colors.warningSoft, fg: Colors.warning }
            : { bg: Colors.white, fg: Colors.textPrimary };

          return (
            <Pressable
              key={bill.id}
              style={[localStyles.billRow, { backgroundColor: tint.bg }]}
              onPress={() => onPressBill(bill, cycleDateKey)}
              onLongPress={() => onLongPressBill(bill)}
            >
              <View style={localStyles.iconBadge}>
                <IconSymbol name={paid ? 'checkmark' : 'bell.fill'} color={tint.fg} size={16} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[localStyles.billTitle, { color: tint.fg }]} numberOfLines={1}>
                  {bill.name} {paid ? '· Paid' : dueLabel(days)}
                </Text>
                <Text style={localStyles.billSub}>
                  {paid ? 'Paid for' : 'Heads up ·'} {formatShortDate(toDateKey(dueDate))}
                </Text>
              </View>
              <Text style={localStyles.billAmount}>{formatCurrency(bill.amount)}</Text>
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => onLongPressBill(bill)}
              >
                <IconSymbol name="ellipsis" color={Colors.textMuted} size={16} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      <ViewMoreToggle
        expanded={expanded}
        onPress={() => setExpanded((p) => !p)}
        hiddenCount={Math.max(0, allUpcoming.length - PREVIEW_COUNT)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  // A little extra room on top of the dashboard stack's own gap between
  // sections — Bill Reminders/Savings Goals/AI Coach otherwise read as
  // crowded against each other since none of the section headers carry any
  // spacing of their own the way a bordered Card's padding naturally would.
  section: {
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowWarning: {
    color: Colors.warning,
  },
  addBtn: {
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.warning,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  billSub: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  billAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
});
