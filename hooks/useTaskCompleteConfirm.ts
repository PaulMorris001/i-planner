import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { isTaskDoneOnDate } from '@/utils/date';
import type { Task } from '@/types/task.types';

// Shared by every place a task row can be tapped to complete it (Planner's
// Day/Week/Month views) — call `requestToggle` from the row's onPress instead
// of useTasks().toggleDone directly, then render <CompleteTaskModal
// visible={!!target} task={target?.task ?? null} onClose={cancel}
// onConfirm={confirm} /> once per screen. Un-completing (already done -> not
// done) needs no confirmation and toggles immediately — only the positive
// "mark complete" direction pauses for the celebratory confirm.
export function useTaskCompleteConfirm() {
  const { toggleDone } = useTasks();
  const [target, setTarget] = useState<{ task: Task; date: Date } | null>(null);

  const requestToggle = (task: Task, date: Date) => {
    if (isTaskDoneOnDate(task, date)) {
      toggleDone(task.id, date);
    } else {
      setTarget({ task, date });
    }
  };

  const confirm = () => {
    if (!target) return;
    toggleDone(target.task.id, target.date);
    setTarget(null);
  };

  const cancel = () => setTarget(null);

  return { target, requestToggle, confirm, cancel };
}
