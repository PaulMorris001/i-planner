import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { GreetingHeader } from '@/components/ui/GreetingHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { TaskCategories, TaskCategoryId, TaskPriorities, TaskPriorityId } from '@/constants/taskMeta';

interface Task {
  id: string;
  title: string;
  category: TaskCategoryId;
  priority: TaskPriorityId;
  day: number;
  hour: number;
  time: string;
  done: boolean;
}

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TODAY_IDX = 1;
const TODAY_DATE = 'Tue, Sep 9';
const PRIORITY_RANK: Record<TaskPriorityId, number> = { high: 0, medium: 1, low: 2 };

const SEED_TASKS: Task[] = [
  { id: 'k1', title: 'Corporate Finance — Case Memo 1', category: 'academic', day: 1, time: '9:30 AM', hour: 9, priority: 'high', done: false },
  { id: 'k2', title: 'Read Marketing — Chapter 4', category: 'academic', day: 1, time: '2:00 PM', hour: 14, priority: 'medium', done: false },
  { id: 'k3', title: 'Coffee chat — McKinsey alum', category: 'career', day: 1, time: '4:00 PM', hour: 16, priority: 'medium', done: false },
  { id: 'k4', title: 'Gym + meal prep', category: 'personal', day: 1, time: '6:30 PM', hour: 18, priority: 'low', done: true },
  { id: 'k5', title: 'Pay tuition installment', category: 'financial', day: 2, time: '10:00 AM', hour: 10, priority: 'high', done: false },
  { id: 'k6', title: 'Group Case — Valuation', category: 'academic', day: 3, time: '11:00 AM', hour: 11, priority: 'high', done: false },
  { id: 'k7', title: 'Bain — interview round 1', category: 'career', day: 4, time: '1:00 PM', hour: 13, priority: 'high', done: false },
  { id: 'k8', title: 'Managerial Econ problem set', category: 'academic', day: 4, time: '3:00 PM', hour: 15, priority: 'medium', done: false },
  { id: 'k9', title: 'Cohort welcome party', category: 'personal', day: 5, time: '7:00 PM', hour: 19, priority: 'low', done: false },
  { id: 'k10', title: 'Weekly review & planning', category: 'personal', day: 6, time: '9:00 AM', hour: 9, priority: 'medium', done: false },
];

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.hour - b.hour);
}

const DAY_TASKS = sortTasks(SEED_TASKS.filter((t) => t.day === TODAY_IDX));

const WEEK_DAYS = DAY_FULL.map((label, i) => ({
  label,
  isToday: i === TODAY_IDX,
  items: sortTasks(SEED_TASKS.filter((t) => t.day === i)),
}));

export default function Planner() {
  const [view, setView] = useState<'day' | 'week'>('day');

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
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

        {view === 'day' ? (
          <>
            <View style={styles.dateRow}>
              <Text style={styles.dateTitle}>Today</Text>
              <Text style={styles.dateSub}>{TODAY_DATE}</Text>
            </View>

            <View style={styles.taskList}>
              {DAY_TASKS.map((task) => {
                const category = TaskCategories[task.category];
                const priority = TaskPriorities[task.priority];
                return (
                  <View key={task.id} style={styles.taskRow}>
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
                        <Text style={styles.time}>{task.time}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.weekList}>
            {WEEK_DAYS.map((day) => (
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
                    day.items.map((task) => {
                      const category = TaskCategories[task.category];
                      return (
                        <View key={task.id} style={styles.weekTaskRow}>
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
                            <Text style={styles.weekTaskTime}>{task.time}</Text>
                          </View>
                          {task.done && (
                            <View style={[styles.weekDoneCircle, { backgroundColor: category.color }]}>
                              <IconSymbol name="checkmark" color={Colors.white} size={12} />
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
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
