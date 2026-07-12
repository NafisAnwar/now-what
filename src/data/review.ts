import { db } from './db';
import type { DailyReview, WeeklyReview, DailyPlan } from '../types';
import { isLocalDate, localDateFromTimestamp, localDateStr, dayAfter, getTodayStr } from '../utils/dateUtils';

export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

export function getWeekEnd(weekStart: string): string {
  const [y, m, day] = weekStart.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, day + 6));
}

export function generateDailySummaryText(data: {
  completedTaskCount: number;
  plannedTaskCount: number;
  missedTaskCount: number;
  completedHabitCount: number;
  totalHabitCount: number;
  focusMinutes: number;
  distractionMinutes: number;
  carryOverCount: number;
  waterMl: number;
  movementMinutes: number;
}): string {
  const parts: string[] = [];

  if (data.plannedTaskCount > 0) {
    parts.push(`${data.completedTaskCount} of ${data.plannedTaskCount} planned tasks completed.`);
  } else if (data.completedTaskCount > 0) {
    parts.push(`${data.completedTaskCount} task(s) completed.`);
  }

  if (data.totalHabitCount > 0) {
    parts.push(`${data.completedHabitCount} of ${data.totalHabitCount} habits completed.`);
  }

  if (data.focusMinutes > 0) {
    parts.push(`Focus total: ${data.focusMinutes} min.`);
  }

  if (data.distractionMinutes > 0) {
    parts.push(`Distraction logged: ${data.distractionMinutes} min.`);
  }

  if (data.waterMl > 0) {
    parts.push(`Water: ${data.waterMl} ml.`);
  }

  if (data.movementMinutes > 0) {
    parts.push(`Movement: ${data.movementMinutes} min.`);
  }

  if (data.carryOverCount > 0) {
    parts.push(`${data.carryOverCount} task(s) carried to tomorrow.`);
  }

  if (data.missedTaskCount > 0) {
    parts.push(`${data.missedTaskCount} task(s) marked missed.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'No activity logged for this day.';
}

const REVIEWABLE_LOG_TYPES = new Set([
  'task_completed',
  'habit_completed',
  'water',
  'meal',
  'exercise',
  'focus',
  'mood',
  'energy',
  'state_check',
  'rest',
  'distraction',
  'note',
]);

export async function hasReviewableActivity(date: string): Promise<boolean> {
  const [logs, calendarTasks] = await Promise.all([
    db.activityLogs.filter(l => isLocalDate(l.createdAt, date)).toArray(),
    db.tasks
      .filter(task =>
        isLocalDate(task.createdAt, date) &&
        typeof task.notes === 'string' &&
        task.notes.startsWith('Created from calendar block ')
      )
      .toArray(),
  ]);

  return logs.some(log => REVIEWABLE_LOG_TYPES.has(log.type)) || calendarTasks.length > 0;
}

export async function isDailyReviewIncomplete(date: string): Promise<boolean> {
  const hasActivity = await hasReviewableActivity(date);
  if (!hasActivity) return false;
  const review = await db.dailyReviews.where('date').equals(date).first() as DailyReview | undefined;
  if (review) return review.status !== 'complete';
  return true;
}

export async function generateDailyReviewData(date: string): Promise<
  Omit<DailyReview, 'id' | 'createdAt' | 'updatedAt' | 'reflectionNote' | 'status' | 'sleepHours' | 'reflection'>
> {
  const logs = await db.activityLogs.filter(l => isLocalDate(l.createdAt, date)).toArray();

  const completedTaskLogs = logs.filter(l => l.type === 'task_completed');
  const completedTaskIds = [...new Set(
    completedTaskLogs.map(l => l.relatedTaskId).filter(Boolean) as string[]
  )];

  const completedHabitLogs = logs.filter(l => l.type === 'habit_completed');
  const completedHabitIds = [...new Set(
    completedHabitLogs.map(l => l.relatedHabitId).filter(Boolean) as string[]
  )];

  const focusMinutes = logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const distractionMinutes = logs.filter(l => l.type === 'distraction').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const restMinutes = logs.filter(l => l.type === 'rest').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const waterMl = logs.filter(l => l.type === 'water').reduce((s, l) => s + (l.quantity || 0), 0);
  const mealsLogged = logs.filter(l => l.type === 'meal').length;
  const movementMinutes = logs.filter(l => l.type === 'exercise').reduce((s, l) => s + (l.durationMinutes || 0), 0);

  const plan = await db.dailyPlans.where('date').equals(date).first();
  const plannedTaskIds = plan?.plannedTaskIds || [];
  const calendarBlockIds = plan?.calendarBlockIds || [];
  const carryOverTaskIds = plan?.carryOverTaskIds || [];

  const missedTaskIds = plannedTaskIds.filter(
    id => !completedTaskIds.includes(id) && !carryOverTaskIds.includes(id)
  );

  const allHabits = await db.habits.where('frequency').equals('daily').toArray();
  const totalHabitCount = allHabits.length;

  const generatedSummary = generateDailySummaryText({
    completedTaskCount: completedTaskIds.length,
    plannedTaskCount: plannedTaskIds.length,
    missedTaskCount: missedTaskIds.length,
    completedHabitCount: completedHabitIds.length,
    totalHabitCount,
    focusMinutes,
    distractionMinutes,
    carryOverCount: carryOverTaskIds.length,
    waterMl,
    movementMinutes,
  });

  return {
    date,
    completedTaskIds,
    missedTaskIds,
    completedHabitIds,
    focusMinutes,
    distractionMinutes,
    restMinutes,
    waterMl,
    mealsLogged,
    movementMinutes,
    calendarBlockIds,
    carryOverTaskIds,
    generatedSummary,
  };
}

export async function getOrCreateDailyReview(date: string): Promise<DailyReview> {
  const existing = await db.dailyReviews.where('date').equals(date).first() as DailyReview | undefined;
  if (existing) return existing;

  const data = await generateDailyReviewData(date);
  const now = new Date().toISOString();
  const review: DailyReview = {
    id: crypto.randomUUID(),
    ...data,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await db.dailyReviews.add(review as never);
  return review;
}

export async function refreshDailyReview(reviewId: string, date: string): Promise<DailyReview> {
  const data = await generateDailyReviewData(date);
  const now = new Date().toISOString();
  await db.dailyReviews.update(reviewId, { ...data, updatedAt: now } as never);
  const updated = await db.dailyReviews.get(reviewId) as DailyReview;
  return updated;
}

export async function saveDailyReviewNote(reviewId: string, note: string): Promise<void> {
  await db.dailyReviews.update(reviewId, {
    reflectionNote: note.trim() || undefined,
    updatedAt: new Date().toISOString(),
  } as never);
}

export async function completeDailyReview(reviewId: string, date: string): Promise<void> {
  const data = await generateDailyReviewData(date);
  const now = new Date().toISOString();
  await db.dailyReviews.update(reviewId, { ...data, status: 'complete', updatedAt: now } as never);
  const plan = await db.dailyPlans.where('date').equals(date).first();
  if (plan) {
    await db.dailyPlans.update(plan.id, { reviewStatus: 'complete', updatedAt: now });
  }
}

// ── Carry-over review actions ────────────────────────────────────────────────

/**
 * Carry a task to the day after `fromDate` (defaults to today).
 * Passing the review's date here ensures yesterday's review carries to today,
 * not to actual-tomorrow.
 */
export async function carryTaskToTomorrow(taskId: string, fromDate?: string): Promise<void> {
  const baseDate = fromDate || getTodayStr();
  const targetStr = dayAfter(baseDate);
  const now = new Date().toISOString();

  const existing = await db.dailyPlans.where('date').equals(targetStr).first();

  if (!existing) {
    const plan: DailyPlan = {
      id: crypto.randomUUID(),
      date: targetStr,
      primaryFocus: undefined,
      plannedTaskIds: [taskId],
      plannedHabitIds: [],
      calendarBlockIds: [],
      lifestyleMinimums: {},
      carryOverTaskIds: [taskId],
      reviewStatus: 'not_started',
      createdAt: now,
      updatedAt: now,
    };
    await db.dailyPlans.add(plan);
  } else {
    const newPlanned = existing.plannedTaskIds.includes(taskId)
      ? existing.plannedTaskIds
      : [...existing.plannedTaskIds, taskId];
    const newCarry = (existing.carryOverTaskIds || []).includes(taskId)
      ? existing.carryOverTaskIds
      : [...(existing.carryOverTaskIds || []), taskId];
    await db.dailyPlans.update(existing.id, {
      plannedTaskIds: newPlanned,
      carryOverTaskIds: newCarry,
      updatedAt: now,
    });
  }

  // Update task carry history (recorded against fromDate, not targetStr)
  const task = await db.tasks.get(taskId);
  if (task) {
    const history = task.carryOverHistory || [];
    if (!history.includes(baseDate)) {
      await db.tasks.update(taskId, {
        carryOverHistory: [...history, baseDate],
        missedCount: (task.missedCount || 0) + 1,
        updatedAt: now,
      });
    }
  }
}

export async function markTaskMissedForDate(taskId: string, date: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const history = task.carryOverHistory || [];
  if (history.includes(date)) return; // already counted for this date
  await db.tasks.update(taskId, {
    carryOverHistory: [...history, date],
    missedCount: (task.missedCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
}

// ── Weekly summary ────────────────────────────────────────────────────────────

export function generateWeeklySummaryText(data: {
  completedTaskCount: number;
  missedTaskCount: number;
  completedHabitCount: number;
  focusMinutes: number;
  distractionMinutes: number;
  restMinutes: number;
  movementMinutes: number;
  waterMl: number;
  mealsLogged: number;
}): string {
  const parts: string[] = [];
  parts.push(`${data.completedTaskCount} task(s) completed this week.`);
  if (data.missedTaskCount > 0) parts.push(`${data.missedTaskCount} task(s) missed.`);
  if (data.completedHabitCount > 0) parts.push(`${data.completedHabitCount} habit completion(s).`);
  if (data.focusMinutes > 0) parts.push(`Total focus: ${data.focusMinutes} min.`);
  if (data.distractionMinutes > 0) parts.push(`Total distraction: ${data.distractionMinutes} min.`);
  if (data.movementMinutes > 0) parts.push(`Movement: ${data.movementMinutes} min.`);
  if (data.waterMl > 0) parts.push(`Water: ${data.waterMl} ml.`);
  return parts.join(' ') || 'No activity recorded for this week.';
}

export async function generateWeeklySummary(weekStart: string): Promise<WeeklyReview> {
  const weekEnd = getWeekEnd(weekStart);
  const now = new Date().toISOString();

  const allLogs = await db.activityLogs.toArray();
  const weekLogs = allLogs.filter(l => {
    const d = localDateFromTimestamp(l.createdAt);
    return d >= weekStart && d <= weekEnd;
  });

  const completedTaskLogs = weekLogs.filter(l => l.type === 'task_completed');
  const completedTaskCount = completedTaskLogs.length;

  const completedHabitLogs = weekLogs.filter(l => l.type === 'habit_completed');
  const completedHabitCount = completedHabitLogs.length;

  const focusMinutes = weekLogs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const distractionMinutes = weekLogs.filter(l => l.type === 'distraction').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const restMinutes = weekLogs.filter(l => l.type === 'rest').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const movementMinutes = weekLogs.filter(l => l.type === 'exercise').reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const waterMl = weekLogs.filter(l => l.type === 'water').reduce((s, l) => s + (l.quantity || 0), 0);
  const mealsLogged = weekLogs.filter(l => l.type === 'meal').length;

  const dailyReviews = (await db.dailyReviews
    .filter(r => r.date >= weekStart && r.date <= weekEnd)
    .toArray()) as DailyReview[];

  const allMissedIds = dailyReviews.flatMap(r => r.missedTaskIds || []);
  const missedTaskCount = allMissedIds.length;

  const missedCounts: Record<string, number> = {};
  for (const id of allMissedIds) {
    missedCounts[id] = (missedCounts[id] || 0) + 1;
  }
  const repeatedMissedIds = Object.entries(missedCounts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  const allTasks = await db.tasks.toArray();
  const repeatedMissedTaskTitles = repeatedMissedIds
    .map(id => allTasks.find(t => t.id === id)?.title)
    .filter(Boolean) as string[];

  const habitCompletionCounts: Record<string, number> = {};
  for (const log of completedHabitLogs) {
    if (log.relatedHabitId) {
      habitCompletionCounts[log.relatedHabitId] = (habitCompletionCounts[log.relatedHabitId] || 0) + 1;
    }
  }
  const allHabits = await db.habits.toArray();
  const mostConsistentHabits = Object.entries(habitCompletionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => allHabits.find(h => h.id === id)?.name)
    .filter(Boolean) as string[];

  const completedHabitIdSet = new Set(completedHabitLogs.map(l => l.relatedHabitId).filter(Boolean));
  const dailyHabits = allHabits.filter(h => h.frequency === 'daily');
  const mostMissedHabits = dailyHabits
    .filter(h => !completedHabitIdSet.has(h.id) || (habitCompletionCounts[h.id] || 0) < 3)
    .slice(0, 3)
    .map(h => h.name);

  let bestFocusWindow: string | undefined;
  const focusLogsWeek = weekLogs.filter(l => l.type === 'focus');
  if (focusLogsWeek.length >= 3) {
    const hourMinutes: Record<number, number> = {};
    for (const l of focusLogsWeek) {
      const h = Math.floor(new Date(l.createdAt).getHours() / 2) * 2;
      hourMinutes[h] = (hourMinutes[h] || 0) + (l.durationMinutes || 0);
    }
    const best = Object.entries(hourMinutes).sort(([, a], [, b]) => b - a)[0];
    if (best) {
      const h = parseInt(best[0]);
      bestFocusWindow = `${String(h).padStart(2, '0')}:00–${String(h + 2).padStart(2, '0')}:00`;
    }
  }

  let struggleWindow: string | undefined;
  const distractionLogsWeek = weekLogs.filter(l => l.type === 'distraction');
  if (distractionLogsWeek.length >= 3) {
    const hourMinutes: Record<number, number> = {};
    for (const l of distractionLogsWeek) {
      const h = Math.floor(new Date(l.createdAt).getHours() / 2) * 2;
      hourMinutes[h] = (hourMinutes[h] || 0) + (l.durationMinutes || 0);
    }
    const worst = Object.entries(hourMinutes).sort(([, a], [, b]) => b - a)[0];
    if (worst) {
      const h = parseInt(worst[0]);
      struggleWindow = `${String(h).padStart(2, '0')}:00–${String(h + 2).padStart(2, '0')}:00`;
    }
  }

  const activeGoals = await db.goals.where('status').equals('active').toArray();
  const goalProgressNotes: string[] = [];
  for (const goal of activeGoals) {
    const linked = completedTaskLogs.filter(l => {
      const task = allTasks.find(t => t.id === l.relatedTaskId);
      return task?.goalId === goal.id;
    }).length;
    if (linked > 0) {
      goalProgressNotes.push(`${goal.title}: ${linked} linked task(s) completed.`);
    }
  }

  const generatedSummary = generateWeeklySummaryText({
    completedTaskCount, missedTaskCount, completedHabitCount,
    focusMinutes, distractionMinutes, restMinutes, movementMinutes, waterMl, mealsLogged,
  });

  const existing = await db.weeklyReviews.where('weekStart').equals(weekStart).first() as WeeklyReview | undefined;

  const review: WeeklyReview = {
    id: existing?.id || crypto.randomUUID(),
    weekStart, weekEnd,
    completedTaskCount, missedTaskCount, completedHabitCount,
    focusMinutes, distractionMinutes, restMinutes, movementMinutes, waterMl, mealsLogged,
    mostConsistentHabits, mostMissedHabits, repeatedMissedTaskTitles,
    bestFocusWindow, struggleWindow, goalProgressNotes, generatedSummary,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    await db.weeklyReviews.update(existing.id, review as never);
  } else {
    await db.weeklyReviews.add(review as never);
  }

  return review;
}
