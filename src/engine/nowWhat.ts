import { db } from '../data/db';
import { isDailyReviewIncomplete } from '../data/review';
import type { Task, Suggestion, SuggestionActionType, Habit, Goal, DailyPlan, CalendarBlock, DailyReview } from '../types';
import { isLocalDate, localDateStr } from '../utils/dateUtils';

export interface Context {
  now: Date;
  hour: number;
  todayStr: string;
  pendingTasks: Task[];
  criticalOverdueTasks: Task[];
  tasksWithDeadlineToday: Task[];
  highPriorityTasks: Task[];
  completedTasksToday: number;
  pendingHabitsInWindow: Habit[];
  pendingHabitsAny: Habit[];
  waterMlToday: number;
  focusMinutesToday: number;
  restMinutesToday: number;
  movementMinutesToday: number;
  distractionMinutesToday: number;
  lastWaterAt: string | null;
  minutesSinceLastWater: number;
  lastEnergyValue: number | null;
  lastMoodValue: number | null;
  lastFocusEndAt: string | null;
  minutesSinceLastFocus: number;
  activeGoals: Goal[];
  todayDailyPlan: DailyPlan | null;
  plannedTaskIds: string[];
  plannedHabitIds: string[];
  goalLinkedPendingTasks: Task[];
  primaryFocus: string | null;
  todaysCalendarBlocks: CalendarBlock[];
  activeCalendarBlock: CalendarBlock | null;
  nextCalendarBlock: CalendarBlock | null;
  minutesUntilNextBlock: number;
  availableWindowMinutes: number;
  todayReviewStatus: 'not_started' | 'in_progress' | 'complete';
  yesterdayReviewIncomplete: boolean;
}

export interface CandidateAction {
  ruleName: string;
  actionType: SuggestionActionType;
  targetId?: string;
  command: string;
  targetLabel: string;
  reason: string;
  priority: number;
}

export async function getCurrentContext(): Promise<Context> {
  const now = new Date();
  const todayStr = localDateStr(now);
  const hour = now.getHours();

  const allTasks = await db.tasks.where('status').equals('pending').toArray();

  const criticalOverdueTasks = allTasks.filter(
    (t) => t.priority === 'critical' && t.dueDate && t.dueDate < todayStr
  );
  criticalOverdueTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  const tasksWithDeadlineToday = allTasks.filter(
    (t) => t.dueDate === todayStr
  );

  const highPriorityTasks = allTasks.filter(
    (t) => (t.priority === 'high' || t.priority === 'critical')
  );

  const todaysLogs = await db.activityLogs.filter(log => isLocalDate(log.createdAt, todayStr)).toArray();
  const completedTasksToday = todaysLogs.filter(log => log.type === 'task_completed').length;

  const waterMlToday = todaysLogs.filter(log => log.type === 'water').reduce((acc, log) => acc + (log.quantity || 0), 0);
  const focusMinutesToday = todaysLogs.filter(log => log.type === 'focus').reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const restMinutesToday = todaysLogs.filter(log => log.type === 'rest').reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const movementMinutesToday = todaysLogs.filter(log => log.type === 'exercise').reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const distractionMinutesToday = todaysLogs.filter(log => log.type === 'distraction').reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const moodLogs = todaysLogs.filter(l => l.type === 'mood').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lastMoodValue = moodLogs.length > 0 ? (moodLogs[0].quantity ?? null) : null;

  const allWaterLogs = await db.activityLogs.where('type').equals('water').toArray();
  allWaterLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastWaterAt = allWaterLogs.length > 0 ? allWaterLogs[allWaterLogs.length - 1].createdAt : null;
  const minutesSinceLastWater = lastWaterAt ? (now.getTime() - new Date(lastWaterAt).getTime()) / 60000 : Infinity;

  const allEnergyLogs = await db.activityLogs.where('type').equals('energy').toArray();
  allEnergyLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastEnergyValue = allEnergyLogs.length > 0 ? (allEnergyLogs[allEnergyLogs.length - 1].quantity ?? null) : null;

  const allFocusLogs = await db.activityLogs.where('type').equals('focus').toArray();
  allFocusLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastFocusEndAt = allFocusLogs.length > 0 ? allFocusLogs[allFocusLogs.length - 1].createdAt : null;
  const minutesSinceLastFocus = lastFocusEndAt ? (now.getTime() - new Date(lastFocusEndAt).getTime()) / 60000 : Infinity;

  const allHabits = await db.habits.toArray();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const pendingHabitsInWindow = allHabits.filter(h => {
    if (h.frequency !== 'daily') return false;
    if (h.completionHistory.some(c => c.date === todayStr)) return false;
    if (h.timeWindowStart && h.timeWindowEnd) {
      return nowHHMM >= h.timeWindowStart && nowHHMM <= h.timeWindowEnd;
    }
    return true;
  });

  const pendingHabitsAny = allHabits.filter(
    h => h.frequency === 'daily' && !h.completionHistory.some(c => c.date === todayStr)
  );

  const activeGoals = await db.goals.where('status').equals('active').toArray();
  const todayDailyPlan = await db.dailyPlans.where('date').equals(todayStr).first() ?? null;
  const plannedTaskIds = todayDailyPlan?.plannedTaskIds ?? [];
  const plannedHabitIds = todayDailyPlan?.plannedHabitIds ?? [];
  const goalLinkedPendingTasks = allTasks.filter(t => t.goalId && activeGoals.some(g => g.id === t.goalId));
  const primaryFocus = todayDailyPlan?.primaryFocus ?? null;

  const todaysCalendarBlocks = await db.calendarBlocks
    .filter(b => isLocalDate(b.startAt, todayStr))
    .toArray();
  todaysCalendarBlocks.sort((a, b) => a.startAt.localeCompare(b.startAt));

  const nowMs = now.getTime();
  const activeCalendarBlock = todaysCalendarBlocks.find(b =>
    nowMs >= new Date(b.startAt).getTime() && nowMs <= new Date(b.endAt).getTime()
  ) || null;
  const futureBlocks = todaysCalendarBlocks.filter(b => new Date(b.startAt).getTime() > nowMs);
  const nextCalendarBlock = futureBlocks.length > 0 ? futureBlocks[0] : null;
  const minutesUntilNextBlock = nextCalendarBlock
    ? Math.max(0, (new Date(nextCalendarBlock.startAt).getTime() - nowMs) / 60000)
    : Infinity;
  const availableWindowMinutes = Number.isFinite(minutesUntilNextBlock) ? minutesUntilNextBlock : 480;

  // Review status
  const todayReview = await db.dailyReviews.where('date').equals(todayStr).first() as DailyReview | undefined;
  const todayReviewStatus = (todayReview?.status as 'not_started' | 'in_progress' | 'complete') ?? 'not_started';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);
  const yesterdayReviewIncomplete = await isDailyReviewIncomplete(yesterdayStr);

  return {
    now,
    hour,
    todayStr,
    pendingTasks: allTasks,
    criticalOverdueTasks,
    tasksWithDeadlineToday,
    highPriorityTasks,
    completedTasksToday,
    pendingHabitsInWindow,
    pendingHabitsAny,
    waterMlToday,
    focusMinutesToday,
    restMinutesToday,
    movementMinutesToday,
    distractionMinutesToday,
    lastWaterAt,
    minutesSinceLastWater,
    lastEnergyValue,
    lastMoodValue,
    lastFocusEndAt,
    minutesSinceLastFocus,
    activeGoals,
    todayDailyPlan,
    plannedTaskIds,
    plannedHabitIds,
    goalLinkedPendingTasks,
    primaryFocus,
    todaysCalendarBlocks,
    activeCalendarBlock,
    nextCalendarBlock,
    minutesUntilNextBlock,
    availableWindowMinutes,
    todayReviewStatus,
    yesterdayReviewIncomplete,
  };
}

export interface ExcludeTarget {
  actionType: SuggestionActionType;
  targetId?: string;
}

export function getCandidateActions(ctx: Context, excludeTargets: ExcludeTarget[] = []): CandidateAction[] {
  const candidates: CandidateAction[] = [];

  const isExcluded = (actionType: SuggestionActionType, targetId?: string) =>
    excludeTargets.some(
      e => e.actionType === actionType && (e.targetId === undefined || e.targetId === targetId)
    );

  // Helper: task fits in available window OR is critical
  const fits = (t: Task) => !t.estimatedMinutes || t.estimatedMinutes <= ctx.availableWindowMinutes || t.priority === 'critical';

  // Rule 0: active calendar block
  if (ctx.activeCalendarBlock && !isExcluded('acknowledge_block', ctx.activeCalendarBlock.id)) {
    candidates.push({
      ruleName: 'active_calendar_block',
      actionType: 'acknowledge_block',
      targetId: ctx.activeCalendarBlock.id,
      command: 'IN BLOCK',
      targetLabel: ctx.activeCalendarBlock.title,
      reason: 'Calendar block in progress: ' + ctx.activeCalendarBlock.title + '. Until ' + (ctx.activeCalendarBlock.endAt.includes('T') ? ctx.activeCalendarBlock.endAt.split('T')[1].slice(0, 5) : ctx.activeCalendarBlock.endAt) + '.',
      priority: 0
    });
  }

  // Rule 1: critical overdue task
  const criticalTask = ctx.criticalOverdueTasks.find(t => !isExcluded('start_task', t.id));
  if (criticalTask) {
    candidates.push({
      ruleName: 'critical_overdue_task',
      actionType: 'start_task',
      targetId: criticalTask.id,
      command: 'START TASK',
      targetLabel: criticalTask.title,
      reason: `Critical task overdue since ${criticalTask.dueDate}.${criticalTask.missedCount > 0 ? ' Missed ' + criticalTask.missedCount + ' time(s).' : ''} Highest priority action right now.`,
      priority: 1
    });
  }

  // Rule 2: task with soonest upcoming deadline (today or future)
  const tasksWithDueDate = ctx.pendingTasks.filter(t => !!t.dueDate);
  if (tasksWithDueDate.length > 0) {
    const sorted = [...tasksWithDueDate].sort((a, b) => {
      const dateDiff = (a.dueDate || '').localeCompare(b.dueDate || '');
      if (dateDiff !== 0) return dateDiff;
      const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return p[a.priority] - p[b.priority];
    });
    const task = sorted.find(t => !isExcluded('start_task', t.id));
    if (task) {
      const isToday = task.dueDate === ctx.todayStr;
      const isOverdue = task.dueDate! < ctx.todayStr;
      const dueLabel = isToday ? 'Due today' : isOverdue ? `Overdue since ${task.dueDate}` : `Due ${task.dueDate}`;
      candidates.push({
        ruleName: 'closest_deadline_task',
        actionType: 'start_task',
        targetId: task.id,
        command: 'START TASK',
        targetLabel: task.title,
        reason: `${dueLabel}. Priority: ${task.priority}.${task.estimatedMinutes ? ' Est. ' + task.estimatedMinutes + ' min.' : ''}`,
        priority: 2
      });
    }
  }

  // Rule 3: high priority task
  const highTask =
    ctx.highPriorityTasks.find(t => ctx.plannedTaskIds.includes(t.id) && t.goalId && fits(t) && !isExcluded('start_task', t.id)) ||
    ctx.highPriorityTasks.find(t => ctx.plannedTaskIds.includes(t.id) && fits(t) && !isExcluded('start_task', t.id)) ||
    ctx.highPriorityTasks.find(t => !!t.goalId && fits(t) && !isExcluded('start_task', t.id)) ||
    ctx.highPriorityTasks.find(t => fits(t) && !isExcluded('start_task', t.id)) ||
    ctx.highPriorityTasks.find(t => !isExcluded('start_task', t.id)); // fallback: any high priority even if doesn't fit
  if (highTask) {
    const goalForTask = highTask.goalId ? ctx.activeGoals.find(g => g.id === highTask.goalId) : null;
    const goalNote = goalForTask ? ' Supports active goal: ' + goalForTask.title + '.' : '';
    const plannedNote = ctx.plannedTaskIds.includes(highTask.id) ? ' Planned for today.' : '';
    const windowNote = Number.isFinite(ctx.availableWindowMinutes) && ctx.availableWindowMinutes < 120
      ? ' Fits before next calendar block. ' + Math.round(ctx.availableWindowMinutes) + ' min available.'
      : '';
    candidates.push({
      ruleName: 'high_priority_task',
      actionType: 'start_task',
      targetId: highTask.id,
      command: 'START TASK',
      targetLabel: highTask.title,
      reason: 'High-priority task pending.' + plannedNote + goalNote + windowNote + ' ' + ctx.completedTasksToday + ' task(s) completed today.',
      priority: 3
    });
  }

  // Rule 3.5: all planned tasks done after 20:00 → elevate review
  const allPlannedDone = ctx.plannedTaskIds.length > 0 &&
    ctx.plannedTaskIds.every(id => !ctx.pendingTasks.some(t => t.id === id));
  if (ctx.hour >= 20 && allPlannedDone && ctx.todayReviewStatus !== 'complete' && !isExcluded('review_day')) {
    candidates.push({
      ruleName: 'end_of_day_all_done',
      actionType: 'review_day',
      command: 'REVIEW DAY',
      targetLabel: 'Daily Review',
      reason: `All planned tasks complete. ${ctx.completedTasksToday} task(s) done today. End-of-day review recommended.`,
      priority: 3.5
    });
  }

  // Rule 4: easy task when low energy
  if (ctx.lastEnergyValue !== null && ctx.lastEnergyValue <= 2) {
    const task = ctx.pendingTasks.find(t => t.energyRequired === 'low' && !isExcluded('start_task', t.id));
    if (task) {
      candidates.push({
        ruleName: 'easy_task_low_energy',
        actionType: 'start_task',
        targetId: task.id,
        command: 'START TASK',
        targetLabel: task.title,
        reason: `Low energy logged (${ctx.lastEnergyValue}/5). Suggesting a low-energy task.`,
        priority: 4
      });
    }
  }

  // Rule 5: habit in time window
  const habitInWindow = ctx.pendingHabitsInWindow.find(h => !isExcluded('complete_habit', h.id));
  if (habitInWindow) {
    candidates.push({
      ruleName: 'habit_in_window',
      actionType: 'complete_habit',
      targetId: habitInWindow.id,
      command: 'COMPLETE HABIT',
      targetLabel: habitInWindow.name,
      reason: `Daily habit pending${habitInWindow.timeWindowStart ? ' — within time window ' + habitInWindow.timeWindowStart + '–' + habitInWindow.timeWindowEnd : ''}.`,
      priority: 5
    });
  }

  // Rule 6: hydration
  if (!isExcluded('log_water') && (ctx.minutesSinceLastWater > 180 || ctx.lastWaterAt === null)) {
    candidates.push({
      ruleName: 'hydration',
      actionType: 'log_water',
      command: 'LOG WATER',
      targetLabel: 'Hydration check',
      reason: ctx.lastWaterAt === null ? 'No water logged today.' : `Last water ${Math.round(ctx.minutesSinceLastWater)} min ago.`,
      priority: 6
    });
  }

  // Rule 7: rest after focus
  if (!isExcluded('rest') && ctx.focusMinutesToday > 0 && ctx.minutesSinceLastFocus !== Infinity && ctx.minutesSinceLastFocus > 90 && ctx.restMinutesToday < 10) {
    candidates.push({
      ruleName: 'rest_after_focus',
      actionType: 'rest',
      command: 'TAKE REST',
      targetLabel: 'Intentional recovery',
      reason: `${ctx.focusMinutesToday}m focus logged. No rest break in over 90 minutes.`,
      priority: 7
    });
  }

  // Rule 8: movement midday
  if (!isExcluded('move') && ctx.movementMinutesToday === 0 && ctx.hour >= 12) {
    candidates.push({
      ruleName: 'movement_midday',
      actionType: 'move',
      command: 'LOG MOVEMENT',
      targetLabel: 'Movement check',
      reason: `No movement logged past midday.`,
      priority: 8
    });
  }

  // Rule 9: general pending task
  if (ctx.pendingTasks.length > 0) {
    const genTask =
      ctx.pendingTasks.find(t => ctx.plannedTaskIds.includes(t.id) && !!t.goalId && fits(t) && !isExcluded('start_task', t.id)) ||
      ctx.pendingTasks.find(t => ctx.plannedTaskIds.includes(t.id) && fits(t) && !isExcluded('start_task', t.id)) ||
      ctx.pendingTasks.find(t => !!t.goalId && fits(t) && !isExcluded('start_task', t.id)) ||
      ctx.pendingTasks.find(t => t.energyRequired === 'low' && fits(t) && !isExcluded('start_task', t.id)) ||
      ctx.pendingTasks.find(t => fits(t) && !isExcluded('start_task', t.id)) ||
      ctx.pendingTasks.find(t => !isExcluded('start_task', t.id)); // fallback
    if (genTask) {
      const goalForTask = genTask.goalId ? ctx.activeGoals.find(g => g.id === genTask.goalId) : null;
      const goalNote = goalForTask ? ' Supports active goal: ' + goalForTask.title + '.' : '';
      const plannedNote = ctx.plannedTaskIds.includes(genTask.id) ? ' Planned for today.' : '';
      candidates.push({
        ruleName: 'general_pending_task',
        actionType: 'start_task',
        targetId: genTask.id,
        command: 'START TASK',
        targetLabel: genTask.title,
        reason: 'Pending task available.' + plannedNote + goalNote + ' ' + ctx.completedTasksToday + ' completed today.',
        priority: 9
      });
    }
  }

  // Rule 10: remaining daily habit
  const remainingHabit = ctx.pendingHabitsAny.find(h => !isExcluded('complete_habit', h.id));
  if (remainingHabit) {
    candidates.push({
      ruleName: 'remaining_daily_habit',
      actionType: 'complete_habit',
      targetId: remainingHabit.id,
      command: 'COMPLETE HABIT',
      targetLabel: remainingHabit.name,
      reason: 'Daily habit still pending.',
      priority: 10
    });
  }

  // Rule 11: end of day review (after 20:00, review not yet complete)
  if (ctx.hour >= 20 && ctx.todayReviewStatus !== 'complete' && !isExcluded('review_day')) {
    candidates.push({
      ruleName: 'end_of_day_review',
      actionType: 'review_day',
      command: 'REVIEW DAY',
      targetLabel: 'Daily Review',
      reason: `${ctx.completedTasksToday} task(s) completed today. End-of-day check recommended.`,
      priority: 11
    });
  }

  // Rule 11b: yesterday's review incomplete
  if (ctx.yesterdayReviewIncomplete && !isExcluded('review_day')) {
    candidates.push({
      ruleName: 'yesterday_review_incomplete',
      actionType: 'review_day',
      command: 'COMPLETE REVIEW',
      targetLabel: "Yesterday's Review",
      reason: "Yesterday's review is incomplete.",
      priority: 11.5
    });
  }

  // Rule 12: clear state fallback
  const plannedDone = ctx.plannedTaskIds.length > 0 &&
    ctx.plannedTaskIds.every(id => !ctx.pendingTasks.some(t => t.id === id));
  const clearReason = plannedDone
    ? 'All planned tasks complete. ' + ctx.completedTasksToday + ' task(s) done today.'
    : 'No pending tasks, habits, or context needs.';
  candidates.push({
    ruleName: 'clear_state',
    actionType: 'clear_state',
    command: 'CLEAR STATE',
    targetLabel: 'Nothing pending',
    reason: clearReason,
    priority: 12
  });

  return candidates.sort((a, b) => a.priority - b.priority);
}

export function rankCandidateActions(candidates: CandidateAction[]): CandidateAction | null {
  return candidates.length > 0 ? candidates[0] : null;
}

export async function persistSuggestion(s: Suggestion): Promise<void> {
  await db.suggestions.add(s);
}

export async function generateWithDebugInfo(excludeTargets: ExcludeTarget[] = []): Promise<{
  suggestion: Suggestion;
  context: Context;
  candidates: CandidateAction[];
}> {
  const shownOnes = await db.suggestions.where('status').equals('shown').toArray();
  await Promise.all(shownOnes.map(s => db.suggestions.update(s.id, { status: 'ignored' })));

  const ctx = await getCurrentContext();
  const candidates = getCandidateActions(ctx, excludeTargets);
  const top = rankCandidateActions(candidates);

  const action = top || candidates[candidates.length - 1]; // fallback

  const suggestion: Suggestion = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    actionType: action.actionType,
    targetId: action.targetId,
    command: action.command,
    targetLabel: action.targetLabel,
    reason: action.reason,
    status: 'shown',
    contextSnapshot: {
      currentTime: ctx.now.toISOString(),
      pendingTaskCount: ctx.pendingTasks.length,
      overdueTaskCount: ctx.criticalOverdueTasks.length,
      incompleteHabitCount: ctx.pendingHabitsAny.length,
      latestEnergy: ctx.lastEnergyValue,
      latestMood: ctx.lastMoodValue,
      waterMlToday: ctx.waterMlToday,
      minutesSinceLastWater: ctx.minutesSinceLastWater === Infinity ? null : ctx.minutesSinceLastWater,
      focusMinutesToday: ctx.focusMinutesToday,
      restMinutesToday: ctx.restMinutesToday,
      distractionMinutesToday: ctx.distractionMinutesToday,
      movementMinutesToday: ctx.movementMinutesToday,
      candidatesConsidered: candidates.length,
      ruleApplied: top?.ruleName ?? 'clear_state',
      todayReviewStatus: ctx.todayReviewStatus,
      yesterdayReviewIncomplete: ctx.yesterdayReviewIncomplete,
    }
  };

  await persistSuggestion(suggestion);

  return { suggestion, context: ctx, candidates };
}

export async function generateNowWhatSuggestion(): Promise<Suggestion> {
  const { suggestion } = await generateWithDebugInfo();
  return suggestion;
}

export async function acceptSuggestion(id: string) {
  await db.suggestions.update(id, { status: 'accepted' });
}

export async function dismissSuggestion(id: string) {
  await db.suggestions.update(id, { status: 'dismissed' });
}

export async function completeSuggestion(id: string) {
  await db.suggestions.update(id, { status: 'completed' });
}
