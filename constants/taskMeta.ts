import { Colors } from '@/constants/theme';

export const TaskCategories = {
  academic: { label: 'Academic', color: Colors.primaryLight, soft: Colors.infoSoft },
  career: { label: 'Career', color: Colors.success, soft: Colors.successSoft },
  personal: { label: 'Personal', color: '#A63B9E', soft: '#F6E9F3' },
  financial: { label: 'Financial', color: Colors.warning, soft: Colors.warningSoft },
  exam: { label: 'Exam', color: '#8B3FD1', soft: '#F1E7FB' },
  habit: { label: 'Habit', color: Colors.warning, soft: Colors.warningSoft },
  other: { label: 'Other', color: Colors.textSecondary, soft: Colors.offWhite },
} as const;

export type TaskCategoryId = keyof typeof TaskCategories;

export const TaskPriorities = {
  high: { label: 'High', color: Colors.error, soft: Colors.errorBg },
  medium: { label: 'Medium', color: Colors.warning, soft: Colors.warningSoft },
  low: { label: 'Low', color: Colors.textMuted, soft: Colors.border },
} as const;

export type TaskPriorityId = keyof typeof TaskPriorities;
