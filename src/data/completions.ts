import { db } from './db';
import type { Habit, Task } from '../types';
import { getTodayStr } from '../utils/dateUtils';

export function isValidHabitCompletionValue(
  completionType: Habit['completionType'],
  value: number | undefined
): boolean {
  if (completionType === 'boolean') return true;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  return completionType === 'quantity' || Number.isInteger(value);
}

async function cancelTargetReminders(targetId: string): Promise<void> {
  const active = await db.reminders
    .filter(reminder =>
      reminder.targetId === targetId &&
      (reminder.status === 'scheduled' || reminder.status === 'sent')
    )
    .toArray();

  if (active.length === 0) return;
  const updatedAt = new Date().toISOString();
  await db.reminders.bulkPut(active.map(reminder => ({
    ...reminder,
    status: 'cancelled' as const,
    updatedAt,
  })));
}

export async function completeTask(taskId: string): Promise<Task | null> {
  return db.transaction('rw', db.tasks, db.activityLogs, db.reminders, async () => {
    const task = await db.tasks.get(taskId);
    if (!task || task.status !== 'pending') return null;

    const completedAt = new Date().toISOString();
    await db.tasks.update(task.id, {
      status: 'complete',
      completedAt,
      updatedAt: completedAt,
    });
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'task_completed',
      label: task.title,
      relatedTaskId: task.id,
      createdAt: completedAt,
    });
    await cancelTargetReminders(task.id);

    return { ...task, status: 'complete', completedAt, updatedAt: completedAt };
  });
}

export async function completeHabit(habitId: string, value?: number): Promise<Habit | null> {
  return db.transaction('rw', db.habits, db.activityLogs, db.reminders, async () => {
    const habit = await db.habits.get(habitId);
    if (!habit || !isValidHabitCompletionValue(habit.completionType, value)) return null;

    const today = getTodayStr();
    const history = Array.isArray(habit.completionHistory) ? habit.completionHistory : [];
    if (history.some(completion => completion.date === today)) return null;

    const completedAt = new Date().toISOString();
    const completionValue = habit.completionType === 'boolean' ? 1 : value;
    const completionHistory = [
      ...history,
      { date: today, value: completionValue, completedAt },
    ];

    await db.habits.update(habit.id, { completionHistory, updatedAt: completedAt });
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'habit_completed',
      label: habit.name,
      relatedHabitId: habit.id,
      quantity: completionValue,
      unit: habit.targetUnit || undefined,
      createdAt: completedAt,
    });
    await cancelTargetReminders(habit.id);

    return { ...habit, completionHistory, updatedAt: completedAt };
  });
}
