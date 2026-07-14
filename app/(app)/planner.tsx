import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { GreetingHeader } from '@/components/ui/GreetingHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CalendarConnectGate } from '@/components/plan/CalendarConnectGate';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskPriorities, TaskPriorityId } from '@/constants/taskMeta';
import { COURSE_COLORS, COURSE_SOFT_COLORS } from '@/constants/classColors';
import { useTasks } from '@/hooks/useTasks';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';
import { confirmDelete } from '@/utils/confirmDelete';
import { weekdayIndexMonday } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import type { Task } from '@/types/task.types';
import type { ClassItem } from '@/types/plan.types';

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRIORITY_RANK: Record<TaskPriorityId, number> = { high: 0, medium: 1, low: 2 };

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.hour - b.hour);
}

function formatTodayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function classDaysShortLabel(item: ClassItem): string {
  if (!item.recurring) return 'One time';
  if (item.freq === 'monthly') return 'Monthly';
  return (item.dayIdxs ?? []).map((i) => DAY_SHORT[i]).join('/');
}

type DayItem =
  | { kind: 'task'; time: number; task: Task }
  | { kind: 'class'; time: number; item: ClassItem; color: string; soft: string };

export default function Planner() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [actionSheetTarget, setActionSheetTarget] = useState<Task | null>(null);
  const { tasks, toggleDone, removeTask } = useTasks();
  const { plan } = usePlan();
  const { openForEdit } = useNewTaskModal();
  const {
    appleCalendarConnected,
    googleCalendarConnected,
    calendarGateDismissed,
    loading: settingsLoading,
    connectAppleCalendar,
    connectGoogleCalendar,
    dismissCalendarGate,
  } = useSettings();

  const handleDeleteTask = (task: Task) => {
    confirmDelete(task.title, () => {
      removeTask(task.id).catch((err) => {
        console.error('[Planner] failed to delete task', err);
      });
    });
  };

  const today = new Date();
  const todayIdx = weekdayIndexMonday(today);
  const todayDateLabel = formatTodayDate(today);

  const classesForDay = (dayIdx: number) =>
    plan.classes
      .map((item, idx) => ({
        item,
        color: COURSE_COLORS[idx % COURSE_COLORS.length],
        soft: COURSE_SOFT_COLORS[idx % COURSE_SOFT_COLORS.length],
      }))
      .filter(({ item }) => (item.dayIdxs ?? []).includes(dayIdx));

  const buildDayItems = (dayIdx: number, taskList: Task[]): DayItem[] => {
    const classItems: DayItem[] = classesForDay(dayIdx)
      .filter(({ item }) => !courseFilter || item.id === courseFilter)
      .map(({ item, color, soft }) => ({ kind: 'class', time: parseTimeToMinutes(item.time), item, color, soft }));
    const taskItems: DayItem[] = sortTasks(taskList).map((task) => ({
      kind: 'task',
      time: parseTimeToMinutes(task.time),
      task,
    }));
    return [...classItems, ...taskItems].sort((a, b) => a.time - b.time);
  };

  const dayItems = buildDayItems(todayIdx, tasks.filter((t) => t.day === todayIdx));
  const weekDays = DAY_FULL.map((label, i) => ({
    label,
    isToday: i === todayIdx,
    items: buildDayItems(i, tasks.filter((t) => t.day === i)),
  }));

  const renderTaskRow = (task: Task) => {
    const category = TaskCategories[task.category];
    const priority = TaskPriorities[task.priority];
    return (
      <Pressable
        key={`task-${task.id}`}
        style={styles.taskRow}
        onPress={() => toggleDone(task.id)}
        onLongPress={() => setActionSheetTarget(task)}
      >
        <View
          style={[
            styles.checkbox,
            task.done
              ? { backgroundColor: category.color }
              : { borderWidth: 1.5, borderColor: Colors.border },
          ]}
        >
          {task.done && <IconSymbol name="checkmark" color={Colors.white} size={14} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            {task.priority === 'high' && !task.done && (
              <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
            )}
            <Text
              style={[
                styles.taskTitle,
                task.done && { color: Colors.textMuted, textDecorationLine: 'line-through' },
              ]}
            >
              {task.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.chip, { color: category.color, backgroundColor: category.soft }]}>
              {category.label}
            </Text>
            <Text style={[styles.chip, { color: priority.color, backgroundColor: priority.soft }]}>
              {priority.label}
            </Text>
            {!!task.time && <Text style={styles.time}>{task.time}</Text>}
          </View>
        </View>
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setActionSheetTarget(task)}
        >
          <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
        </Pressable>
      </Pressable>
    );
  };

  const renderClassRow = (item: ClassItem, color: string, soft: string) => (
    <View key={`class-${item.id}`} style={[styles.classRow, { backgroundColor: soft }]}>
      <View style={[styles.classIconBox, { backgroundColor: color }]}>
        <IconSymbol name="calendar" color={Colors.white} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.classTitle}>{item.courseName}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.chip, { color, backgroundColor: Colors.white }]}>Class</Text>
          {!!item.time && <Text style={styles.time}>{item.time}</Text>}
        </View>
        <Text style={styles.classRecur}>↻ {classDaysShortLabel(item)}</Text>
      </View>
    </View>
  );

  const calendarConnected = appleCalendarConnected || googleCalendarConnected;
  if (!settingsLoading && !calendarConnected && !calendarGateDismissed) {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite} edges={['top', 'right', 'left']}>
        <GreetingHeader />
        <CalendarConnectGate
          onConnectApple={async () => {
            const ok = await connectAppleCalendar();
            if (!ok) {
              Alert.alert(
                "Couldn't connect calendar",
                'Calendar permission was denied. You can allow it later from your device settings.'
              );
            }
          }}
          onConnectGoogle={async () => {
            const ok = await connectGoogleCalendar();
            if (!ok) {
              Alert.alert("Couldn't connect calendar", 'Something went wrong finishing the Google sign-in. Try again.');
            }
          }}
          onSkip={dismissCalendarGate}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent} edges={['top', 'right', 'left']}>
      <GreetingHeader />

      <View style={styles.body}>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segment, view === 'day' && styles.segmentActive]}
            onPress={() => setView('day')}
          >
            <Text style={view === 'day' ? styles.segmentTextActive : styles.segmentText}>Day</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, view === 'week' && styles.segmentActive]}
            onPress={() => setView('week')}
          >
            <Text style={view === 'week' ? styles.segmentTextActive : styles.segmentText}>Week</Text>
          </Pressable>
        </View>

        {plan.classes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courseFilterRow}
          >
            <Pressable
              style={[styles.courseChip, !courseFilter && styles.courseChipActive]}
              onPress={() => setCourseFilter(null)}
            >
              <Text style={[styles.courseChipText, !courseFilter && styles.courseChipTextActive]}>
                All courses
              </Text>
            </Pressable>
            {plan.classes.map((c, idx) => {
              const color = COURSE_COLORS[idx % COURSE_COLORS.length];
              const on = courseFilter === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[styles.courseChip, on && { backgroundColor: color, borderColor: color }]}
                  onPress={() => setCourseFilter(on ? null : c.id)}
                >
                  <View style={[styles.courseDot, { backgroundColor: on ? Colors.white : color }]} />
                  <Text style={[styles.courseChipText, on && styles.courseChipTextActive]} numberOfLines={1}>
                    {c.courseName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {view === 'day' ? (
          <>
            <View style={styles.dateRow}>
              <Text style={styles.dateTitle}>Today</Text>
              <Text style={styles.dateSub}>{todayDateLabel}</Text>
            </View>

            <View style={styles.taskList}>
              {dayItems.length === 0 ? (
                <Text style={styles.noTasks}>No tasks yet — tap the + button to add one.</Text>
              ) : (
                dayItems.map((di) =>
                  di.kind === 'class' ? renderClassRow(di.item, di.color, di.soft) : renderTaskRow(di.task)
                )
              )}
            </View>
          </>
        ) : (
          <View style={styles.weekList}>
            {weekDays.map((day) => (
              <View key={day.label}>
                <View style={styles.weekDayHeader}>
                  <Text style={[styles.weekDayLabel, day.isToday && { color: Colors.primaryLight }]}>
                    {day.label}
                  </Text>
                  <Text style={styles.weekDayCount}>{day.items.length} tasks</Text>
                </View>
                <View style={styles.weekItemList}>
                  {day.items.length === 0 ? (
                    <Text style={styles.noTasks}>No tasks</Text>
                  ) : (
                    day.items.map((di) => {
                      if (di.kind === 'class') {
                        return renderClassRow(di.item, di.color, di.soft);
                      }
                      const task = di.task;
                      const category = TaskCategories[task.category];
                      return (
                        <Pressable
                          key={`wk-task-${task.id}`}
                          style={styles.weekTaskRow}
                          onPress={() => toggleDone(task.id)}
                          onLongPress={() => setActionSheetTarget(task)}
                        >
                          <View style={[styles.weekTaskBar, { backgroundColor: category.color }]} />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.weekTaskTitle,
                                task.done && { color: Colors.textMuted, textDecorationLine: 'line-through' },
                              ]}
                            >
                              {task.title}
                            </Text>
                            {!!task.time && <Text style={styles.weekTaskTime}>{task.time}</Text>}
                          </View>
                          {task.done && (
                            <View style={[styles.weekDoneCircle, { backgroundColor: category.color }]}>
                              <IconSymbol name="checkmark" color={Colors.white} size={12} />
                            </View>
                          )}
                          <Pressable
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => setActionSheetTarget(task)}
                          >
                            <IconSymbol name="ellipsis" color={Colors.textMuted} size={16} />
                          </Pressable>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <ItemActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        onEdit={() => actionSheetTarget && openForEdit(actionSheetTarget)}
        onDelete={() => actionSheetTarget && handleDeleteTask(actionSheetTarget)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  body: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  courseFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingRight: Spacing.md,
  },
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  courseChipActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  courseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  courseChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  courseChipTextActive: {
    color: Colors.white,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  dateSub: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  taskList: {
    marginTop: 12,
    gap: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  taskTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 3,
  },
  chip: {
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 14,
  },
  classIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  classRecur: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  weekList: {
    marginTop: 16,
    gap: 16,
  },
  weekDayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  weekDayLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  weekDayCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  weekItemList: {
    marginTop: 9,
    gap: 7,
  },
  noTasks: {
    fontSize: 12.5,
    color: Colors.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  weekTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  weekTaskBar: {
    width: 4,
    height: 30,
    borderRadius: 999,
  },
  weekTaskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  weekTaskTime: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  weekDoneCircle: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
