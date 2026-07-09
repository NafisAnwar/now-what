import { db } from '../data/db';
import { isDailyReviewIncomplete } from '../data/review';
import { getCalendarBlocksForDate } from '../data/calendar';
import type { Task, Suggestion, SuggestionActionType, Habit, Goal, DailyPlan, CalendarBlock, DailyReview } from '../types';
import { isLocalDate, localDateStr } from '../utils/dateUtils';

export type MoodState = 'CLEAR' | 'NEUTRAL' | 'LOW' | 'STRESSED' | 'RESTLESS' | 'OVERLOADED';
export type EnergySignal = 'LOW' | 'MEDIUM' | 'HIGH';
export type FocusCapacity = 'DEEP' | 'NORMAL' | 'LIGHT' | 'RECOVERY';

export interface Context {
  now: Date;
  hour: number;
  todayStr: string;
  pendingTasks: Task[];
  criticalOverdueTasks: Task[];
  tasksWithDeadlineToday: Task[];
  highPriorityTasks: Task[];
  completedTasksToday: number;
  meaningfulActivityCountToday: number;
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
  latestMoodState: MoodState;
  latestEnergyLevel: EnergySignal | null;
  currentFocusCapacity: FocusCapacity;
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
  basePriority?: number;
  stateAdjustment?: number;
  stateAffected?: boolean;
  stateReason?: string;
}

interface StateSignalInput {
  moodValue: number | null;
  energyValue: number | null;
  focusMinutesToday: number;
  restMinutesToday: number;
  distractionMinutesToday: number;
  minutesSinceLastFocus: number;
}

interface TaskFitResult {
  adjustment: number;
  reason: string | null;
}

const HARD_RULES = new Set(['active_calendar_block', 'critical_overdue_task', 'closest_deadline_task']);

export function normalizeEnergyLevel(value: number | null): EnergySignal | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 2) return 'LOW';
  if (value >= 4) return 'HIGH';
  return 'MEDIUM';
}

export function normalizeMoodState(input: StateSignalInput): MoodState {
  const { moodValue, energyValue, restMinutesToday, distractionMinutesToday } = input;
  const energyLevel = normalizeEnergyLevel(energyValue);
  const hasMood = moodValue !== null && Number.isFinite(moodValue);
  const hasEnergy = energyValue !== null && Number.isFinite(energyValue);
  const restlessSignal = distractionMinutesToday >= 20 && restMinutesToday < 10;

  if (hasMood && hasEnergy) {
    if (moodValue <= 2 && energyValue <= 2) return 'OVERLOADED';
    if (moodValue <= 2 && energyValue >= 3) return 'STRESSED';
    if (moodValue >= 4 && energyValue >= 4) return 'CLEAR';
    if (moodValue >= 4 && energyValue <= 2) return restlessSignal ? 'RESTLESS' : 'LOW';
  }

  if (energyLevel === 'LOW') return 'LOW';
  if (hasMood && moodValue <= 2) return 'STRESSED';
  if (restlessSignal && energyLevel !== 'LOW') return 'RESTLESS';
  return 'NEUTRAL';
}

export function deriveFocusCapacity(input: StateSignalInput & { moodState: MoodState; energyLevel: EnergySignal | null }): FocusCapacity {
  const { moodState, energyLevel, focusMinutesToday, restMinutesToday, distractionMinutesToday, minutesSinceLastFocus } = input;
  const focusWithoutRest = focusMinutesToday >= 90 && restMinutesToday < 10;
  const recentLongFocus = minutesSinceLastFocus !== Infinity && minutesSinceLastFocus < 20 && focusMinutesToday >= 60 && restMinutesToday < 10;

  if (moodState === 'OVERLOADED' || focusWithoutRest || recentLongFocus) return 'RECOVERY';
  if (moodState === 'LOW' || moodState === 'STRESSED') return 'LIGHT';
  if (moodState === 'RESTLESS') return distractionMinutesToday >= 20 ? 'LIGHT' : 'NORMAL';
  if (moodState === 'CLEAR' && energyLevel === 'HIGH') return 'DEEP';
  return 'NORMAL';
}

function taskMinutes(task: Task): number | null {
  return typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes)
    ? task.estimatedMinutes
    : null;
}

function isShortTask(task: Task): boolean {
  const minutes = taskMinutes(task);
  return minutes !== null && minutes <= 30;
}

function isLongTask(task: Task): boolean {
  const minutes = taskMinutes(task);
  return minutes !== null && minutes >= 60;
}

function categoryText(task: Task): string {
  return String(task.category || '').toLowerCase();
}

function isAdminOrMaintenanceTask(task: Task): boolean {
  const category = categoryText(task);
  return category.includes('admin') || category.includes('maintenance') || category.includes('personal');
}

function isPhysicalTask(task: Task): boolean {
  const category = categoryText(task);
  return category.includes('health') || category.includes('movement') || category.includes('exercise') || category.includes('physical');
}

function isUrgentTask(task: Task, ctx: Context): boolean {
  return task.priority === 'critical' || Boolean(task.dueDate && task.dueDate <= ctx.todayStr);
}

function fitsAvailableWindow(task: Task, ctx: Context): boolean {
  return !task.estimatedMinutes || task.estimatedMinutes <= ctx.availableWindowMinutes || task.priority === 'critical';
}

function smallestPlannedTaskMinutes(ctx: Context): number | null {
  const plannedMinutes = ctx.pendingTasks
    .filter(task => ctx.plannedTaskIds.includes(task.id))
    .map(taskMinutes)
    .filter((minutes): minutes is number => minutes !== null);

  return plannedMinutes.length > 0 ? Math.min(...plannedMinutes) : null;
}

function taskBaseScore(task: Task, ctx: Context): number {
  const priorityScore: Record<Task['priority'], number> = { critical: 5, high: 3, medium: 2, low: 1 };
  let score = priorityScore[task.priority] ?? 0;

  if (task.dueDate) {
    if (task.dueDate < ctx.todayStr) score += 5;
    else if (task.dueDate === ctx.todayStr) score += 4;
    else score += 1.5;
  }

  if (ctx.plannedTaskIds.includes(task.id)) score += 2;
  if (task.goalId) score += 1.25;
  if (fitsAvailableWindow(task, ctx)) score += 0.5;
  else score -= 2.5;
  if (!task.estimatedMinutes) score -= 0.35;

  return score;
}

function taskStateFit(task: Task, ctx: Context): TaskFitResult {
  if (ctx.latestMoodState === 'NEUTRAL' && ctx.currentFocusCapacity === 'NORMAL') {
    return { adjustment: 0, reason: null };
  }

  let adjustment = 0;
  const minutes = taskMinutes(task);
  const planned = ctx.plannedTaskIds.includes(task.id);
  const goalLinked = Boolean(task.goalId);
  const short = isShortTask(task);
  const long = isLongTask(task);
  const lowEnergy = task.energyRequired === 'low';
  const highEnergy = task.energyRequired === 'high';
  const adminOrMaintenance = isAdminOrMaintenanceTask(task);
  const physical = isPhysicalTask(task);
  const urgent = isUrgentTask(task, ctx);
  const fitsWindow = fitsAvailableWindow(task, ctx);
  const smallestPlanned = smallestPlannedTaskMinutes(ctx);
  const isSmallestPlanned = planned && minutes !== null && smallestPlanned !== null && minutes <= smallestPlanned;

  switch (ctx.latestMoodState) {
    case 'CLEAR':
      if (planned) adjustment += 1.6;
      if (goalLinked) adjustment += 1.4;
      if (task.priority === 'high' || task.priority === 'critical') adjustment += 1;
      if (fitsWindow && minutes !== null && minutes >= 45) adjustment += 0.6;
      if (ctx.currentFocusCapacity === 'DEEP' && highEnergy) adjustment += 0.5;
      break;
    case 'LOW':
      if (lowEnergy) adjustment += 2;
      if (short) adjustment += 1.6;
      if (adminOrMaintenance) adjustment += 1.1;
      if (long && highEnergy && !urgent) adjustment -= 2.4;
      else if (highEnergy && !urgent) adjustment -= 1;
      break;
    case 'STRESSED':
      if (short) adjustment += 1.7;
      if (task.dueDate && task.dueDate <= ctx.todayStr) adjustment += 1;
      if (planned && minutes !== null) adjustment += 1;
      if (!task.estimatedMinutes && !urgent) adjustment -= 1.2;
      if (long && !urgent) adjustment -= 1.5;
      break;
    case 'RESTLESS':
      if (physical) adjustment += 2.4;
      if (short) adjustment += 1;
      if (minutes !== null && minutes <= 20) adjustment += 0.6;
      if (long && !urgent) adjustment -= 1;
      break;
    case 'OVERLOADED':
      if (isSmallestPlanned) adjustment += 2.6;
      else if (planned) adjustment += 1;
      if (lowEnergy) adjustment += 1.6;
      if (short) adjustment += 1.6;
      if (long && !urgent) adjustment -= 2.6;
      if (highEnergy && !urgent) adjustment -= 1.2;
      break;
    case 'NEUTRAL':
      break;
  }

  if (ctx.currentFocusCapacity === 'RECOVERY') {
    if (short || lowEnergy) adjustment += 0.9;
    if (long && highEnergy && !urgent) adjustment -= 1.8;
  } else if (ctx.currentFocusCapacity === 'LIGHT') {
    if (short || lowEnergy) adjustment += 0.6;
    if (long && highEnergy && !urgent) adjustment -= 1.1;
  } else if (ctx.currentFocusCapacity === 'DEEP') {
    if ((planned || goalLinked || task.priority === 'high') && fitsWindow) adjustment += 0.7;
  }

  return {
    adjustment,
    reason: stateReasonForTask(task, ctx, adjustment),
  };
}

function stateReasonForTask(task: Task, ctx: Context, adjustment: number): string | null {
  if (adjustment < 1.8 || ctx.latestMoodState === 'NEUTRAL') return null;

  switch (ctx.latestMoodState) {
    case 'CLEAR':
      return ctx.plannedTaskIds.includes(task.id)
        ? 'Current state logged clear. Suggesting a high-value planned task.'
        : 'Current state logged clear. Suggesting a high-value task.';
    case 'LOW':
      return 'Energy logged low. Suggesting a short low-friction task.';
    case 'STRESSED':
      return 'Current state logged stressed. Suggesting a concrete short task.';
    case 'RESTLESS':
      return isPhysicalTask(task)
        ? 'Current state logged restless. Suggesting a movement-friendly task.'
        : 'Fits current state and available time.';
    case 'OVERLOADED':
      return ctx.plannedTaskIds.includes(task.id)
        ? 'Current state logged overloaded. Suggesting the smallest planned action.'
        : 'Current state logged overloaded. Suggesting a short low-friction task.';
    case 'NEUTRAL':
      return null;
  }
}

function taskReadinessScore(task: Task, ctx: Context): number {
  return taskBaseScore(task, ctx) + taskStateFit(task, ctx).adjustment;
}

function selectTaskByReadiness(tasks: Task[], ctx: Context): Task | undefined {
  return [...tasks].sort((a, b) => {
    const scoreDiff = taskReadinessScore(b, ctx) - taskReadinessScore(a, ctx);
    if (scoreDiff !== 0) return scoreDiff;
    const aMinutes = taskMinutes(a) ?? Infinity;
    const bMinutes = taskMinutes(b) ?? Infinity;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return a.createdAt.localeCompare(b.createdAt);
  })[0];
}

function appendStateReason(reason: string, note: string | null): string {
  if (!note) return reason;
  if (reason.includes(note)) return reason;
  if (/low energy logged/i.test(reason) && note.startsWith('Energy logged low')) return reason;
  return `${reason}${reason.endsWith(' ') ? '' : ' '}${note}`;
}

function candidateStateFit(candidate: CandidateAction, ctx: Context): TaskFitResult {
  if (HARD_RULES.has(candidate.ruleName)) return { adjustment: 0, reason: null };

  if (candidate.actionType === 'start_task' && candidate.targetId) {
    const task = ctx.pendingTasks.find(t => t.id === candidate.targetId);
    return task ? taskStateFit(task, ctx) : { adjustment: 0, reason: null };
  }

  if (ctx.latestMoodState === 'RESTLESS' && candidate.actionType === 'move') {
    return { adjustment: 2.2, reason: 'Current state logged restless. Suggesting movement.' };
  }

  if (ctx.latestMoodState === 'OVERLOADED') {
    if (candidate.actionType === 'review_day') {
      return { adjustment: 2, reason: 'Current state logged overloaded. Suggesting a review action.' };
    }
    if (candidate.actionType === 'rest') {
      return { adjustment: 2.2, reason: 'Current state logged overloaded. Suggesting a recovery action.' };
    }
  }

  if (ctx.latestMoodState === 'LOW' && candidate.actionType === 'rest') {
    return { adjustment: 1.4, reason: 'Energy logged low. Suggesting a low-friction action.' };
  }

  return { adjustment: 0, reason: null };
}

function applyStateAdjustments(candidates: CandidateAction[], ctx: Context): CandidateAction[] {
  return candidates
    .map(candidate => {
      const fit = candidateStateFit(candidate, ctx);
      const stateAffected = Math.abs(fit.adjustment) >= 1.8;
      const shift = Math.max(-0.75, Math.min(0.85, fit.adjustment * 0.18));
      const priority = HARD_RULES.has(candidate.ruleName)
        ? candidate.priority
        : Math.max(2.05, candidate.priority - shift);

      return {
        ...candidate,
        priority,
        basePriority: candidate.priority,
        stateAdjustment: fit.adjustment,
        stateAffected,
        stateReason: stateAffected ? fit.reason ?? undefined : undefined,
        reason: stateAffected ? appendStateReason(candidate.reason, fit.reason) : candidate.reason,
      };
    })
    .sort((a, b) => a.priority - b.priority);
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
  const meaningfulActivityCountToday = todaysLogs.filter(log => log.type !== 'calendar').length;

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
  const latestEnergyLevel = normalizeEnergyLevel(lastEnergyValue);
  const latestMoodState = normalizeMoodState({
    moodValue: lastMoodValue,
    energyValue: lastEnergyValue,
    focusMinutesToday,
    restMinutesToday,
    distractionMinutesToday,
    minutesSinceLastFocus,
  });
  const currentFocusCapacity = deriveFocusCapacity({
    moodValue: lastMoodValue,
    energyValue: lastEnergyValue,
    focusMinutesToday,
    restMinutesToday,
    distractionMinutesToday,
    minutesSinceLastFocus,
    moodState: latestMoodState,
    energyLevel: latestEnergyLevel,
  });

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

  const todaysCalendarBlocks = await getCalendarBlocksForDate(db, todayStr);

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
    meaningfulActivityCountToday,
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
    latestMoodState,
    latestEnergyLevel,
    currentFocusCapacity,
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

function hasMeaningfulUserContext(ctx: Context): boolean {
  const hasDailyPlanContext =
    ctx.plannedTaskIds.length > 0 ||
    ctx.plannedHabitIds.length > 0 ||
    (ctx.todayDailyPlan?.calendarBlockIds?.length ?? 0) > 0 ||
    (ctx.todayDailyPlan?.carryOverTaskIds?.length ?? 0) > 0 ||
    Boolean(ctx.primaryFocus);

  return (
    ctx.pendingTasks.length > 0 ||
    ctx.pendingHabitsAny.length > 0 ||
    ctx.activeGoals.length > 0 ||
    ctx.todaysCalendarBlocks.length > 0 ||
    hasDailyPlanContext ||
    ctx.meaningfulActivityCountToday > 0 ||
    ctx.yesterdayReviewIncomplete
  );
}

function makeNoContextCandidate(): CandidateAction {
  return {
    ruleName: 'no_context_available',
    actionType: 'clear_state',
    command: 'NO CONTEXT AVAILABLE',
    targetLabel: 'Add a task, habit, or calendar block to activate recommendations.',
    reason: 'NOW_WHAT? needs at least one user-created item before it can suggest the next action.',
    priority: 12,
  };
}

export function getCandidateActions(ctx: Context, excludeTargets: ExcludeTarget[] = []): CandidateAction[] {
  const candidates: CandidateAction[] = [];

  const isExcluded = (actionType: SuggestionActionType, targetId?: string) =>
    excludeTargets.some(
      e => e.actionType === actionType && (e.targetId === undefined || e.targetId === targetId)
    );

  // Helper: task fits in available window OR is critical
  const fits = (t: Task) => fitsAvailableWindow(t, ctx);

  if (!hasMeaningfulUserContext(ctx)) {
    return [makeNoContextCandidate()];
  }

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
      const priorityDiff = p[a.priority] - p[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return taskReadinessScore(b, ctx) - taskReadinessScore(a, ctx);
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
  const highTask = selectTaskByReadiness(
    ctx.highPriorityTasks.filter(t => fits(t) && !isExcluded('start_task', t.id)),
    ctx
  );
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
  if (ctx.latestEnergyLevel === 'LOW' || ctx.latestMoodState === 'LOW' || ctx.latestMoodState === 'OVERLOADED') {
    const task = selectTaskByReadiness(
      ctx.pendingTasks.filter(t =>
        (t.energyRequired === 'low' || isShortTask(t) || isAdminOrMaintenanceTask(t)) &&
        !isExcluded('start_task', t.id)
      ),
      ctx
    );
    if (task) {
      candidates.push({
        ruleName: 'easy_task_low_energy',
        actionType: 'start_task',
        targetId: task.id,
        command: 'START TASK',
        targetLabel: task.title,
        reason: ctx.lastEnergyValue !== null
          ? `Low energy logged (${ctx.lastEnergyValue}/5). Suggesting a low-energy task.`
          : 'Current state favors a short low-friction task.',
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
    const fittingTasks = ctx.pendingTasks.filter(t => fits(t) && !isExcluded('start_task', t.id));
    const fallbackTasks = ctx.pendingTasks.filter(t => !isExcluded('start_task', t.id));
    const genTask = selectTaskByReadiness(fittingTasks.length > 0 ? fittingTasks : fallbackTasks, ctx);
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

  return applyStateAdjustments(candidates, ctx);
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
      meaningfulActivityCountToday: ctx.meaningfulActivityCountToday,
      latestEnergy: ctx.lastEnergyValue,
      latestMood: ctx.lastMoodValue,
      latestMoodState: ctx.latestMoodState,
      latestEnergyLevel: ctx.latestEnergyLevel,
      currentFocusCapacity: ctx.currentFocusCapacity,
      waterMlToday: ctx.waterMlToday,
      minutesSinceLastWater: ctx.minutesSinceLastWater === Infinity ? null : ctx.minutesSinceLastWater,
      focusMinutesToday: ctx.focusMinutesToday,
      restMinutesToday: ctx.restMinutesToday,
      distractionMinutesToday: ctx.distractionMinutesToday,
      movementMinutesToday: ctx.movementMinutesToday,
      candidatesConsidered: candidates.length,
      ruleApplied: top?.ruleName ?? 'clear_state',
      selectedStateAffected: Boolean(action.stateAffected),
      selectedStateAdjustment: action.stateAdjustment ?? 0,
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
