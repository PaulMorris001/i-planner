import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, InteractionManager, View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { TaskCategories } from '@/constants/taskMeta';
import { COURSE_COLORS } from '@/constants/classColors';
import { useTasks } from '@/hooks/useTasks';
import { weekdayIndexMonday, localMidnight, parseISODateLocal, isTaskDoneOnDate } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import type { Task } from '@/types/task.types';
import type { ClassItem } from '@/types/plan.types';

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// >3 items on a day collapses to 2 dots + a bare "+" overflow glyph.
const MAX_VISIBLE_DOTS = 2;

interface MonthCalendarViewProps {
  classes: ClassItem[];
  courseFilter: string | null;
  onTaskLongPress: (task: Task) => void;
  onClassLongPress: (item: ClassItem) => void;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return localMidnight(a) === localMidnight(b);
}

// dayIdxs match every week in both directions from the anchor date (startDate/dueDate); without
// this a class recurring every Monday would wrongly show dots on Mondays before it existed.
function hasStartedBy(anchorIso: string, cellDate: Date): boolean {
  if (!anchorIso) return true;
  const anchor = parseISODateLocal(anchorIso);
  return Number.isNaN(anchor.getTime()) || localMidnight(cellDate) >= localMidnight(anchor);
}

function monthYearLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fullDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Pulsing placeholder for the detail panel while its content loads (see panelLoading below).
function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.detailRow, { opacity }]}>
      <View style={[styles.detailBar, styles.skeletonBlock]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonBlock, styles.skeletonTitleBlock]} />
        <View style={[styles.skeletonBlock, styles.skeletonTimeBlock]} />
      </View>
    </Animated.View>
  );
}

export function MonthCalendarView({ classes, courseFilter, onTaskLongPress, onClassLongPress }: MonthCalendarViewProps) {
  const { tasks, toggleDone } = useTasks();
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const goToMonth = (offset: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSelectedDate(null);
  };

  const classColorById = useMemo(
    () => new Map(classes.map((c, idx) => [c.id, COURSE_COLORS[idx % COURSE_COLORS.length]])),
    [classes]
  );

  // Recurring items match by weekday (like Day/Week); one-time items match by their real date
  // instead, so they show exactly once rather than repeating on every matching weekday.
  const classesOnDate = (date: Date): ClassItem[] => {
    const wd = weekdayIndexMonday(date);
    return classes
      .filter((c) => !courseFilter || c.id === courseFilter)
      .filter((c) => {
        if (c.recurring) return hasStartedBy(c.startDate, date) && (c.dayIdxs ?? []).includes(wd);
        const start = parseISODateLocal(c.startDate);
        return !Number.isNaN(start.getTime()) && isSameLocalDay(start, date);
      });
  };

  const tasksOnDate = (date: Date): Task[] => {
    const wd = weekdayIndexMonday(date);
    return tasks.filter((t) => {
      if (t.recurring && t.freq && t.dayIdxs?.length) {
        return hasStartedBy(t.dueDate, date) && t.dayIdxs.includes(wd);
      }
      if (!t.dueDate) return false;
      const due = parseISODateLocal(t.dueDate);
      return !Number.isNaN(due.getTime()) && isSameLocalDay(due, date);
    });
  };

  const dotsForDate = (date: Date): { key: string; color: string }[] => [
    ...classesOnDate(date).map((c) => ({ key: `c-${c.id}`, color: classColorById.get(c.id) ?? COURSE_COLORS[0] })),
    ...tasksOnDate(date).map((t) => ({ key: `t-${t.id}`, color: TaskCategories[t.category].color })),
  ];

  // Memoized since computing dots scans every class/task per cell (up to 42 cells); selectedDate
  // isn't a dependency, so tapping a day doesn't re-run the scan.
  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const leading = weekdayIndexMonday(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - leading + 1;
      const date = new Date(year, month, dayNum);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      return { date, inMonth, dots: dotsForDate(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor, classes, tasks, courseFilter, classColorById]);

  // Building the detail panel is comparatively heavy on a busy day; deferring it past the tap's
  // interaction/animation lets the selection highlight paint first, with a skeleton meanwhile.
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelData, setPanelData] = useState<{ classes: ClassItem[]; tasks: Task[] } | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setPanelData(null);
      setPanelLoading(false);
      return;
    }
    setPanelLoading(true);
    const date = selectedDate;
    const task = InteractionManager.runAfterInteractions(() => {
      setPanelData({
        classes: classesOnDate(date),
        tasks: [...tasksOnDate(date)].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)),
      });
      setPanelLoading(false);
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, classes, tasks, courseFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        <Pressable hitSlop={10} onPress={() => goToMonth(-1)}>
          <IconSymbol name="chevron.left" color={Colors.textPrimary} size={20} />
        </Pressable>
        <Text style={styles.navLabel}>{monthYearLabel(monthCursor)}</Text>
        <Pressable hitSlop={10} onPress={() => goToMonth(1)}>
          <IconSymbol name="chevron.right" color={Colors.textPrimary} size={20} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map(({ date, inMonth, dots }) => {
          const isToday = isSameLocalDay(date, today);
          const isSelected = !!selectedDate && isSameLocalDay(date, selectedDate);
          const overflow = dots.length > MAX_VISIBLE_DOTS + 1;
          const visibleDots = overflow ? dots.slice(0, MAX_VISIBLE_DOTS) : dots;
          // Selected wins over today's blue text so the number stays legible against the dark fill.
          const numberColor = isSelected
            ? Colors.white
            : isToday
            ? Colors.primaryLight
            : !inMonth
            ? Colors.textMuted
            : Colors.textPrimary;
          return (
            <Pressable
              key={date.toISOString()}
              style={styles.cell}
              onPress={() => setSelectedDate(date)}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: Colors.textPrimary },
                  isToday && !isSelected && styles.dayCircleTodayRing,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    { color: numberColor },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View style={styles.dotRow}>
                {visibleDots.map((dot) => (
                  <View key={dot.key} style={[styles.dot, { backgroundColor: dot.color }]} />
                ))}
                {overflow && <Text style={styles.overflowPlus}>+</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedDate && (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailDate}>{fullDateLabel(selectedDate)}</Text>
            <Pressable hitSlop={10} onPress={() => setSelectedDate(null)}>
              <IconSymbol name="xmark" color={Colors.textMuted} size={18} />
            </Pressable>
          </View>

          {panelLoading || !panelData ? (
            <View style={styles.detailGroup}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : panelData.classes.length === 0 && panelData.tasks.length === 0 ? (
            <Text style={styles.noItems}>Nothing scheduled for this day.</Text>
          ) : (
            <>
              {panelData.classes.length > 0 && (
                <View style={styles.detailGroup}>
                  <Text style={styles.detailGroupLabel}>Classes</Text>
                  {panelData.classes.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.detailRow}
                      onPress={() => onClassLongPress(item)}
                      onLongPress={() => onClassLongPress(item)}
                    >
                      <View style={[styles.detailBar, { backgroundColor: classColorById.get(item.id) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailTitle}>{item.courseName}</Text>
                        {!!item.time && <Text style={styles.detailTime}>{item.time}</Text>}
                        {(!!item.professor || !!item.venue) && (
                          <Text style={styles.detailTime} numberOfLines={1}>
                            {[item.professor && `👤 ${item.professor}`, item.venue && `📍 ${item.venue}`]
                              .filter(Boolean)
                              .join('   ')}
                          </Text>
                        )}
                      </View>
                      <Pressable hitSlop={8} onPress={() => onClassLongPress(item)}>
                        <IconSymbol name="ellipsis" color={Colors.textMuted} size={16} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              )}

              {panelData.tasks.length > 0 && (
                <View style={styles.detailGroup}>
                  <Text style={styles.detailGroupLabel}>Tasks</Text>
                  {panelData.tasks.map((task) => {
                    const category = TaskCategories[task.category];
                    const done = isTaskDoneOnDate(task, selectedDate);
                    return (
                      <Pressable
                        key={task.id}
                        style={styles.detailRow}
                        onPress={() => toggleDone(task.id, selectedDate)}
                        onLongPress={() => onTaskLongPress(task)}
                      >
                        <View style={[styles.detailBar, { backgroundColor: category.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.detailTitle,
                              done && { color: Colors.textMuted, textDecorationLine: 'line-through' },
                            ]}
                          >
                            {task.title}
                          </Text>
                          {!!task.time && <Text style={styles.detailTime}>{task.time}</Text>}
                          {!!task.notes?.trim() && (
                            <Text style={styles.detailNotes} numberOfLines={1}>
                              {task.notes.trim()}
                            </Text>
                          )}
                        </View>
                        <Pressable hitSlop={8} onPress={() => onTaskLongPress(task)}>
                          <IconSymbol name="ellipsis" color={Colors.textMuted} size={16} />
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navLabel: {
    fontSize: 15.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 5,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dayCircleTodayRing: {
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  dayNumber: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dayNumberSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 10,
    marginTop: 3,
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  overflowPlus: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    lineHeight: 10,
  },
  detailPanel: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDate: {
    fontSize: 15.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  noItems: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
  },
  detailGroup: {
    marginTop: 14,
    gap: 8,
  },
  detailGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailRow: {
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
  detailBar: {
    width: 4,
    height: 28,
    borderRadius: 999,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailTime: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  detailNotes: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  skeletonBlock: {
    backgroundColor: Colors.border,
    borderRadius: 999,
  },
  skeletonTitleBlock: {
    height: 12,
    width: '55%',
  },
  skeletonTimeBlock: {
    height: 10,
    width: '30%',
  },
});
