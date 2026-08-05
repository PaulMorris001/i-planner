import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ViewAllRow } from '@/components/ui/ViewAllRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCardHeader } from '@/components/ui/SectionCardHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COURSE_COLORS } from '@/constants/classColors';
import { Routes } from '@/constants/routes';
import { TaskCategories, TaskPriorities, type TaskCategoryId, type TaskPriorityId } from '@/constants/taskMeta';
import { Colors } from '@/constants/theme';
import { usePlan } from '@/hooks/usePlan';
import { useTasks } from '@/hooks/useTasks';
import { useGoals } from '@/hooks/useGoals';
import { useSyllabi } from '@/hooks/useSyllabi';
import type { ClassItem } from '@/types/plan.types';
import type { Goal } from '@/types/goal.types';
import { computeTaskStreak, weekdayIndexMonday, isDueTodayOrLater, localMidnight, parseISODateLocal } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import { formatShortDate } from './dashboardHelpers';
import { dashboardStyles as styles } from './dashboardStyles';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function classDaysLabel(item: ClassItem): string {
  if (!item.recurring) return 'One time';
  if (item.freq === 'monthly') return 'Monthly';
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join(' · ');
}

// True when dateIso falls within the current Monday-Sunday week.
function isThisWeek(dateIso: string): boolean {
  const date = parseISODateLocal(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekdayIndexMonday(now));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return date >= monday && date < nextMonday;
}

interface StudentPathViewProps {
  // Dashboard's shared Calendar/Goals quick-links block — passed in rather
  // than rebuilt here so it doesn't remount when the path view re-renders.
  quickLinks: ReactNode;
  onAddClass: () => void;
  onAddSyllabus: () => void;
  onViewGoal: (goal: Goal) => void;
}

export function StudentPathView({ quickLinks, onAddClass, onAddSyllabus, onViewGoal }: StudentPathViewProps) {
  const router = useRouter();
  const { plan } = usePlan();
  const { tasks } = useTasks();
  const { goals } = useGoals();
  const { syllabi } = useSyllabi();

  const taskStreak = computeTaskStreak(tasks);
  const thisWeeksGoals = goals.filter((g) => g.targetDate && isThisWeek(g.targetDate));

  // Classes happening today, matched against the real current weekday.
  const todayIdx = weekdayIndexMonday(new Date());
  const todaysClasses = plan.classes
    .filter((c) => (c.dayIdxs ?? []).includes(todayIdx))
    .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

  // Most-recently-created first — class ids are Date.now() timestamps, so a
  // numeric sort on id doubles as a creation-order sort.
  const recentClasses = [...plan.classes].sort((a, b) => Number(b.id) - Number(a.id));
  const visibleClasses = recentClasses.slice(0, 3);

  // Nearest dated items from onboarding (recruitment tasks + "other" items
  // that were given a date) plus real tasks with a due date, soonest-first
  // and excluding anything already past or done — this feeds both the "Up
  // next" stat card and the UPCOMING list below. Only real tasks carry
  // category/priority/time — recruitment/other items don't have that data.
  const studentUpcoming: {
    title: string;
    date: string;
    dotColor: string;
    category?: TaskCategoryId;
    priority?: TaskPriorityId;
    time?: string;
  }[] = [
    ...plan.recruitment.map((r) => ({
      title: `${r.company} — ${r.taskType}`,
      date: r.date,
      dotColor: Colors.primaryLight,
    })),
    ...plan.other
      .filter((o) => !!o.date)
      .map((o) => ({ title: o.title, date: o.date, dotColor: Colors.warning })),
    ...tasks
      .filter((t) => !!t.dueDate && !t.done)
      .map((t) => ({
        title: t.title,
        date: t.dueDate,
        dotColor: TaskCategories[t.category].color,
        category: t.category,
        priority: t.priority,
        time: t.time,
      })),
  ]
    // Calendar-day comparison, not raw instant — recruitment/other/task dates
    // each carry a different, essentially arbitrary time-of-day (see
    // isDueTodayOrLater), so comparing full timestamps against Date.now() can
    // wrongly drop something still due later today.
    .filter((item) => isDueTodayOrLater(item.date))
    .sort((a, b) => localMidnight(parseISODateLocal(a.date)) - localMidnight(parseISODateLocal(b.date)))
    .slice(0, 3);

  return (
    <>
      {/* Study streak + Up next */}
      <View style={styles.statsRow}>
        <StatCard label="Study streak" flex={1.3}>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{taskStreak}</Text>
            <Text style={styles.statUnit}>days</Text>
          </View>
        </StatCard>
        <StatCard label="Up next" flex={0.7}>
          {studentUpcoming.length > 0 ? (
            <>
              <Text style={styles.statNextTitle} numberOfLines={1}>
                {studentUpcoming[0].title}
              </Text>
              <Text style={styles.statNextDate}>{formatShortDate(studentUpcoming[0].date)}</Text>
            </>
          ) : (
            <Text style={styles.statNextTitle}>Nothing scheduled</Text>
          )}
        </StatCard>
      </View>

      {quickLinks}

      {/* Today's Classes */}
      <Card style={styles.card}>
        <Text style={styles.todayTitle}>Today's Classes</Text>
        {todaysClasses.length > 0 ? (
          <View style={{ gap: 8, marginTop: 11 }}>
            {todaysClasses.map((c) => {
              const color = COURSE_COLORS[plan.classes.indexOf(c) % COURSE_COLORS.length];
              return (
                <View key={c.id} style={styles.classRow}>
                  <View style={[styles.classBar, { backgroundColor: color }]} />
                  <Text style={styles.classRowTitle} numberOfLines={1}>
                    {c.courseName}
                  </Text>
                  <Text style={styles.classRowTime}>{c.time}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.noClassText, { marginTop: 10 }]}>No classes scheduled today.</Text>
        )}
      </Card>

      {/* My Classes */}
      <Card style={styles.card}>
        <SectionCardHeader title="My Classes" actionLabel="Add Class" onActionPress={onAddClass} />
        {visibleClasses.length > 0 ? (
          <View style={{ gap: 8, marginTop: 11 }}>
            {visibleClasses.map((c) => {
              const color = COURSE_COLORS[plan.classes.indexOf(c) % COURSE_COLORS.length];
              return (
                <View key={c.id} style={styles.classRow}>
                  <View style={[styles.classBar, { backgroundColor: color }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.classRowTitle} numberOfLines={1}>
                      {c.courseName}
                    </Text>
                    <Text style={styles.classRowMeta}>
                      {classDaysLabel(c)}
                      {c.time ? ` · ${c.time}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            {plan.classes.length > 3 && (
              <ViewAllRow
                label={`View all ${plan.classes.length} classes`}
                onPress={() => router.push(Routes.CLASSES)}
              />
            )}
          </View>
        ) : (
          <Text style={[styles.noClassText, { marginTop: 10 }]}>No classes added yet.</Text>
        )}
      </Card>

      {/* My Syllabi */}
      <Card style={styles.card}>
        <SectionCardHeader title="My Syllabi" actionLabel="Add Syllabus" onActionPress={onAddSyllabus} />
        {syllabi.length > 0 ? (
          <View style={{ gap: 8, marginTop: 11 }}>
            {syllabi.slice(0, 3).map((syllabus) => (
              <View key={syllabus.id} style={styles.syllabusRow}>
                <View style={styles.syllabusIconBox}>
                  <IconSymbol name="doc.fill" color={Colors.primaryLight} size={15} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.classRowTitle} numberOfLines={1}>
                    {syllabus.courseName}
                  </Text>
                  <Text style={styles.classRowMeta} numberOfLines={1}>
                    {syllabus.fileName}
                  </Text>
                </View>
              </View>
            ))}
            {syllabi.length > 3 && (
              <ViewAllRow
                label={`View all ${syllabi.length} syllabi`}
                onPress={() => router.push(Routes.SYLLABI)}
              />
            )}
          </View>
        ) : (
          <Text style={[styles.noClassText, { marginTop: 10 }]}>No syllabi yet.</Text>
        )}
      </Card>

      {/* This week's goal(s) */}
      <View style={{ gap: 9 }}>
        <Text style={styles.eyebrowMuted}>
          {thisWeeksGoals.length > 1 ? "THIS WEEK'S GOALS" : "THIS WEEK'S GOAL"}
        </Text>
        {thisWeeksGoals.length === 0 ? (
          <EmptyState
            icon="target"
            title="No goals due this week"
            subtitle="Set a due date on a goal to see it here."
            onPress={() => router.push(Routes.GOALS)}
          />
        ) : (
          thisWeeksGoals.map((goal) => (
            <Card key={goal.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.weekGoalTitle} numberOfLines={1}>
                  {goal.title}
                </Text>
                <Text style={styles.mono}>{goal.pct}%</Text>
              </View>
              <View style={[styles.progressTrack, { marginTop: 10 }]}>
                <AnimatedProgressBar pct={goal.pct} color={Colors.primaryLight} />
              </View>
              <Pressable
                style={[styles.viewButton, { alignSelf: 'flex-end', marginTop: 11 }]}
                onPress={() => onViewGoal(goal)}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </Pressable>
            </Card>
          ))
        )}
      </View>

      {/* Upcoming */}
      <View style={{ gap: 9 }}>
        <Text style={styles.eyebrowMuted}>UPCOMING</Text>
        {studentUpcoming.length === 0 && (
          <Text style={styles.noClassText}>
            Nothing coming up — add recruitment tasks or other items from onboarding.
          </Text>
        )}
        {studentUpcoming.map((item) => (
          <View key={`${item.title}-${item.date}`} style={styles.upcomingRow}>
            <View style={[styles.upcomingDot, { backgroundColor: item.dotColor }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.upcomingTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {(item.category || item.priority || item.time) && (
                <View style={styles.upcomingMetaRow}>
                  {item.category && (
                    <Text
                      style={[
                        styles.upcomingMetaChip,
                        { color: TaskCategories[item.category].color, backgroundColor: TaskCategories[item.category].soft },
                      ]}
                    >
                      {TaskCategories[item.category].label}
                    </Text>
                  )}
                  {item.priority && (
                    <Text
                      style={[
                        styles.upcomingMetaChip,
                        { color: TaskPriorities[item.priority].color, backgroundColor: TaskPriorities[item.priority].soft },
                      ]}
                    >
                      {TaskPriorities[item.priority].label}
                    </Text>
                  )}
                  {!!item.time && <Text style={styles.upcomingMetaTime}>{item.time}</Text>}
                </View>
              )}
            </View>
            <Text style={styles.upcomingDate}>{formatShortDate(item.date)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
