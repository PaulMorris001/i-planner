import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface FaqItem {
  question: string;
  // Plain paragraphs, or "label|value" rows rendered as a small table.
  paragraphs?: string[];
  rows?: [string, string][];
  after?: string;
}

// Keep the numbers in step with backend/src/constants/points.ts and
// backend/src/constants/referral.ts.
function buildFaq(showStudy: boolean): FaqItem[] {
  const earnRows: [string, string][] = [
    ['Complete a task', '2'],
    ['Complete a goal milestone', '5'],
    ['Finish a whole goal', '25 extra'],
    ['Check in a habit', '2'],
    ['7 day / 30 day habit streak', '5 / 25 extra'],
    ['Pay a bill', '8 (+2 if on time)'],
    ['Add money to a savings goal', '3'],
    ['Reach a savings goal', '10 extra'],
    ...(showStudy ? ([['Study, every full 30 minutes', '2']] as [string, string][]) : []),
    ['A friend signs up with your code', '100'],
    ['You sign up with a friend’s code', '50'],
  ];

  return [
    {
      question: 'What are points for?',
      paragraphs: [
        'Points show how active you are. They count toward the weekly leaderboard and the flame at the top of your home screen. They are for bragging rights only: there is nothing to redeem.',
      ],
    },
    {
      question: 'How do I earn points?',
      rows: earnRows,
      after: 'Every award is for something you actually did in the app.',
    },
    {
      question: 'Can I earn points twice for the same thing?',
      paragraphs: [
        'No. Each task, milestone, bill or study session pays once. Unticking and ticking it again earns nothing more. Repeating things (daily habits, recurring tasks and bills) pay once per day or per cycle. Savings updates pay once per goal per day.',
      ],
    },
    {
      question: 'Why didn’t I get points?',
      paragraphs: [
        'Something you created only earns points once it is at least 10 minutes old. Repeating items only count for today, not past days. A bill needs a real due date.' +
          (showStudy ? ' Study time under 10 minutes is not logged, and time while paused does not count.' : ''),
      ],
    },
    {
      question: 'How does the weekly leaderboard work?',
      paragraphs: [
        'It ranks everyone by the points they earned this week. A week runs from Monday to Sunday and starts again from zero each Monday. If two people have the same points, whoever got there first ranks higher. Everyone appears under an anonymous name, never a real one.',
      ],
    },
  ];
}

// The "how do points work" FAQ at the bottom of the Profile screen. Each question
// opens and closes on tap.
export function PointsFaq({ showStudy }: { showStudy: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = buildFaq(showStudy);

  return (
    <View style={styles.card}>
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <View key={item.question} style={[styles.item, index > 0 && styles.itemBorder]}>
            <Pressable
              style={styles.questionRow}
              onPress={() => setOpenIndex(open ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.question}>{item.question}</Text>
              <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} color={Colors.textSecondary} size={20} />
            </Pressable>
            {open && (
              <View style={styles.answer}>
                {item.paragraphs?.map((p) => (
                  <Text key={p} style={styles.answerText}>
                    {p}
                  </Text>
                ))}
                {item.rows?.map(([label, value]) => (
                  <View key={label} style={styles.tableRow}>
                    <Text style={styles.tableLabel}>{label}</Text>
                    <Text style={styles.tableValue}>{value}</Text>
                  </View>
                ))}
                {!!item.after && <Text style={[styles.answerText, styles.after]}>{item.after}</Text>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: 16 },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 14 },
  question: { flex: 1, fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  answer: { paddingBottom: 14 },
  answerText: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  after: { marginTop: 8 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  tableLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  tableValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
});
