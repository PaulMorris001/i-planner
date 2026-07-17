import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import type { Exam } from '@/types/plan.types';

const CARD_WIDTH = Dimensions.get('window').width - Spacing.md * 2;
const CARD_GAP = 12;
const ROTATE_INTERVAL_MS = 8000;

// Cycled by index so each exam's card reads as visually distinct.
const GRADIENTS: [string, string][] = [
  ['#8B3FD1', '#5A2A99'], // purple
  ['#2563EB', '#1E3A8A'], // blue
  ['#DB2777', '#9D174D'], // pink
  ['#059669', '#065F46'], // green
  ['#EA580C', '#9A3412'], // orange
];

function daysUntil(examDate: string): number {
  return Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function topicProgress(exam: Exam): { done: number; total: number; pct: number } {
  const total = exam.topics?.length ?? 0;
  const done = exam.topics?.filter((t) => t.done).length ?? 0;
  return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ExamCarouselProps {
  exams: Exam[]; // pre-sorted, soonest first
  onTrackPress: (examId: string) => void;
}

export function ExamCarousel({ exams, onTrackPress }: ExamCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Keep the active dot in range if the exam list shrinks (e.g. removed elsewhere).
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, exams.length - 1)));
  }, [exams.length]);

  // Auto-advance every 5s. Restarts only when the exam count changes, not on
  // every render (sortedExams is a fresh array each render in the parent).
  useEffect(() => {
    if (exams.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % exams.length;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [exams.length]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveIndex(idx);
  };

  if (exams.length === 0) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ width: CARD_WIDTH }}
      >
        {exams.map((exam, i) => {
          const progress = topicProgress(exam);
          return (
            <View key={exam.id} style={{ width: CARD_WIDTH, paddingRight: CARD_GAP }}>
              <LinearGradient
                colors={GRADIENTS[i % GRADIENTS.length]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Text style={styles.heroLabel}>
                  {exam.name} · {formatShortDate(exam.examDate)}
                </Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{daysUntil(exam.examDate)}</Text>
                  <Text style={styles.heroUnit}>days to go</Text>
                </View>
                <View style={styles.heroProgressTrack}>
                  <View style={[styles.heroProgressFill, { width: `${progress.pct}%` }]} />
                </View>
                <Text style={styles.heroSub}>
                  {progress.total > 0
                    ? `${progress.done} of ${progress.total} topics complete`
                    : 'No study topics yet'}
                </Text>
                <Pressable style={styles.heroButton} onPress={() => onTrackPress(exam.id)}>
                  <Text style={styles.heroButtonText}>Track my progress</Text>
                  <IconSymbol name="chevron.right" color={Colors.white} size={16} />
                </Pressable>
              </LinearGradient>
            </View>
          );
        })}
      </ScrollView>

      {exams.length > 1 && (
        <View style={styles.dotsRow}>
          {exams.map((exam, i) => (
            <View key={exam.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 19,
    padding: 20,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.85,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  heroValue: {
    fontSize: 46,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
    lineHeight: 46,
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.9,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 16,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.white,
  },
  heroSub: {
    fontSize: 12.5,
    fontWeight: '500',
    color: Colors.white,
    opacity: 0.9,
    marginTop: 8,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  heroButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.white,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: '#8B3FD1',
  },
});
