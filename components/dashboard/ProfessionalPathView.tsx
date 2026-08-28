import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StatCard } from '@/components/ui/StatCard';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import { useGoals } from '@/hooks/useGoals';
import { useTasks } from '@/hooks/useTasks';
import type { Goal } from '@/types/goal.types';
import { taskOccursOnDay, weekdayIndexMonday, formatMonthYear, isTaskDoneOnDate } from '@/utils/date';
import { dashboardStyles as styles } from './dashboardStyles';

interface ProfessionalPathViewProps {
  // Passed in rather than rebuilt here so it doesn't remount on re-render.
  quickLinks: ReactNode;
  onViewGoal: (goal: Goal | null) => void;
}

export function ProfessionalPathView({ quickLinks, onViewGoal }: ProfessionalPathViewProps) {
  const router = useRouter();
  const { tasks } = useTasks();
  const { goals } = useGoals();

  const careerGoal = goals.find((g) => g.type === 'career');
  const careerMilestonesDone = careerGoal?.milestones.filter((m) => m.done).length ?? 0;
  const nextCareerMilestone = careerGoal?.milestones.find((m) => !m.done);

  // Today's task completion, for the "Today's tasks" stat.
  const today = new Date();
  const todayIdx = weekdayIndexMonday(today);
  const todaysTasks = tasks.filter((t) => taskOccursOnDay(t, todayIdx));
  const todaysTasksDone = todaysTasks.filter((t) => isTaskDoneOnDate(t, today)).length;

  return (
    <>
      {/* Today's tasks + Weekly action */}
      <View style={styles.statsRow}>
        <StatCard label="Today's tasks">
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{todaysTasksDone}</Text>
            <Text style={styles.statUnit}>/ {todaysTasks.length} done</Text>
          </View>
        </StatCard>
        <StatCard label="Weekly action">
          <Text style={styles.statNextTitle} numberOfLines={2}>
            {nextCareerMilestone?.title ?? 'Nothing this week'}
          </Text>
        </StatCard>
      </View>

      {quickLinks}

      {/* Career goal */}
      <Card style={styles.card}>
        {careerGoal ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrowGreen}>CAREER GOAL</Text>
              <Text style={styles.mono}>
                {careerMilestonesDone} / {careerGoal.milestones.length}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{careerGoal.title}</Text>
            {!!(careerGoal.targetRole || careerGoal.targetIndustry || careerGoal.targetDate) && (
              <Text style={styles.goalMeta}>
                {[
                  careerGoal.targetRole,
                  careerGoal.targetIndustry,
                  careerGoal.targetDate ? formatMonthYear(careerGoal.targetDate) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}

            <View style={[styles.rowBetween, { marginTop: 13 }]}>
              <Text style={styles.careerPct}>{careerGoal.pct}%</Text>
              <Text style={styles.goalMeta}>
                {careerMilestonesDone} / {careerGoal.milestones.length} milestones
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <AnimatedProgressBar pct={careerGoal.pct} color={Colors.success} />
            </View>

            {nextCareerMilestone && (
              <View style={styles.weeklyActionRow}>
                <IconSymbol name="clock" color={Colors.textSecondary} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.weeklyActionLabel}>WEEKLY CAREER ACTION</Text>
                  <Text style={styles.weeklyActionTitle} numberOfLines={1}>
                    {nextCareerMilestone.title}
                  </Text>
                </View>
                <Pressable style={styles.viewButton} onPress={() => onViewGoal(careerGoal ?? null)}>
                  <Text style={styles.viewButtonText}>View</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.eyebrowMuted}>CAREER GOAL</Text>
            <EmptyState
              icon="plus"
              title="Set a career goal"
              subtitle="Add one from the Goals page to track it here."
              onPress={() => router.push(Routes.GOALS)}
            />
          </>
        )}
      </Card>
    </>
  );
}
