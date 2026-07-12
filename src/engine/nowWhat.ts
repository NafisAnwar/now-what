import { db } from '../data/db';
import { hasReviewableActivity, isDailyReviewIncomplete } from '../data/review';
import { getCalendarBlocksForDate } from '../data/calendar';
import { getOrCreateNeedsProfile } from '../data/needsProfile';
import { MICRO_ACTIONS, getMicroActionById } from './microActions';
import {
  getCriticalSupportText,
  getUserEnergyBand,
  isHardRuleCandidate,
  scoreAndRankCandidates,
} from './recommendationScoring';
import type {
  CandidateScoreBreakdown,
  CalendarBlock,
  DailyPlan,
  DailyReview,
  FocusCapacity as ProfileFocusCapacity,
  Goal,
  Habit,
  MicroActionIntent,
  NeedsProfile,
  RecommendationDeck,
  StateType,
  Suggestion,
  SuggestionActionType,
  Task,
  UserEnergyBand,
} from '../types';
import { isLocalDate, localDateStr } from '../utils/dateUtils';

export type MoodState = 'CLEAR' | 'NEUTRAL' | 'LOW' | 'STRESSED' | 'RESTLESS' | 'OVERLOADED';
export type EnergySignal = 'LOW' | 'MEDIUM' | 'HIGH';
export type FocusCapacity = 'DEEP' | 'NORMAL' | 'LIGHT' | 'RECOVERY';

export interface Context {
  now: Date;
  hour: number;
  todayStr: string;
  yesterdayStr: string;
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
  userEnergyBand: UserEnergyBand | null;
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
  totalTaskCount: number;
  totalHabitCount: number;
  totalCalendarBlockCount: number;
  hasUserContext: boolean;
  activeCalendarBlock: CalendarBlock | null;
  nextCalendarBlock: CalendarBlock | null;
  minutesUntilNextBlock: number;
  availableWindowMinutes: number;
  todayReviewStatus: 'not_started' | 'in_progress' | 'complete';
  todayReviewAvailable: boolean;
  hasReviewableActivityToday: boolean;
  yesterdayReviewIncomplete: boolean;
  needsProfile: NeedsProfile;
  minutesSinceLastTaskCreated: number;
  activeCooldownCount: number;
  selectedCandidateIdentity: string | null;
  excludedCandidateIdentities: string[];
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
  identity?: string;
  cooldownReason?: string;
  cooldownUntil?: string;
  scoreBreakdown?: CandidateScoreBreakdown;
  microActionId?: string;
  actionIntent?: MicroActionIntent;
  supportText?: string;
  isAlternative?: boolean;
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
const COOLDOWN_OVERRIDE_RULES = new Set(['active_calendar_block', 'critical_overdue_task']);
const STATE_RULES = new Set(['no_context_available', 'no_action_ready', 'clear_state']);
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

interface ActiveCooldown {
  identity: string;
  until: string;
  reason: string;
}

interface CooldownFilterResult {
  candidates: CandidateAction[];
  coolingCandidates: CandidateAction[];
  excludedCandidateIdentities: string[];
  activeCooldownCount: number;
}

export function normalizeEnergyLevel(value: number | null): EnergySignal | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 2) return 'LOW';
  if (value >= 4) return 'HIGH';
  return 'MEDIUM';
}

export function normalizeLoggedState(value: StateType | undefined): MoodState | null {
  switch (value) {
    case 'clear': return 'CLEAR';
    case 'neutral': return 'NEUTRAL';
    case 'low': return 'LOW';
    case 'stressed': return 'STRESSED';
    case 'restless': return 'RESTLESS';
    case 'overloaded': return 'OVERLOADED';
    default: return null;
  }
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
  if (restlessSignal) return 'RESTLESS';
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
      return ctx.lastEnergyValue !== null
        ? 'Energy level is low. Suggesting a short low-friction task.'
        : 'Current state logged low. Suggesting a short low-friction task.';
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
    return {
      adjustment: 1.4,
      reason: ctx.lastEnergyValue !== null
        ? 'Energy level is low. Suggesting a low-friction action.'
        : 'Current state logged low. Suggesting a low-friction action.',
    };
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

  const taskRecords = await db.tasks.toArray();
  const allTasks = taskRecords.filter(task => task.status === 'pending');
  const latestTaskCreatedAt = taskRecords
    .map(task => new Date(task.createdAt).getTime())
    .filter(timestamp => Number.isFinite(timestamp))
    .sort((a, b) => b - a)[0];
  const minutesSinceLastTaskCreated = latestTaskCreatedAt === undefined
    ? Infinity
    : Math.max(0, (now.getTime() - latestTaskCreatedAt) / 60000);

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

  const allEnergyLogs = await db.activityLogs.where('type').anyOf(['energy', 'state_check']).toArray();
  allEnergyLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestEnergyLog = [...allEnergyLogs]
    .reverse()
    .find(log => {
      const value = log.type === 'state_check' ? log.energyLevel : log.quantity;
      return typeof value === 'number' && Number.isFinite(value);
    });
  const lastEnergyValue = latestEnergyLog
    ? (latestEnergyLog.type === 'state_check' ? latestEnergyLog.energyLevel ?? null : latestEnergyLog.quantity ?? null)
    : null;
  const latestStateCheck = [...allEnergyLogs]
    .reverse()
    .find(log => log.type === 'state_check' && normalizeLoggedState(log.state) !== null);

  const allFocusLogs = await db.activityLogs.where('type').equals('focus').toArray();
  allFocusLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastFocusEndAt = allFocusLogs.length > 0 ? allFocusLogs[allFocusLogs.length - 1].createdAt : null;
  const minutesSinceLastFocus = lastFocusEndAt ? (now.getTime() - new Date(lastFocusEndAt).getTime()) / 60000 : Infinity;
  const latestEnergyLevel = normalizeEnergyLevel(lastEnergyValue);
  const userEnergyBand = getUserEnergyBand(lastEnergyValue);
  const inferredMoodState = normalizeMoodState({
    moodValue: lastMoodValue,
    energyValue: lastEnergyValue,
    focusMinutesToday,
    restMinutesToday,
    distractionMinutesToday,
    minutesSinceLastFocus,
  });
  const loggedState = normalizeLoggedState(latestStateCheck?.state);
  const latestMoodState = loggedState && (
    moodLogs.length === 0 ||
    (latestStateCheck?.createdAt ?? '') >= moodLogs[0].createdAt
  )
    ? loggedState
    : inferredMoodState;
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
  const needsProfile = await getOrCreateNeedsProfile();
  const todayDailyPlan = await db.dailyPlans.where('date').equals(todayStr).first() ?? null;
  const plannedTaskIds = todayDailyPlan?.plannedTaskIds ?? [];
  const plannedHabitIds = todayDailyPlan?.plannedHabitIds ?? [];
  const goalLinkedPendingTasks = allTasks.filter(t => t.goalId && activeGoals.some(g => g.id === t.goalId));
  const primaryFocus = todayDailyPlan?.primaryFocus ?? null;

  const allCalendarBlocks = await db.calendarBlocks.toArray();
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
  const todayReviewAvailable = await hasReviewableActivity(todayStr);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);
  const yesterdayReviewIncomplete = await isDailyReviewIncomplete(yesterdayStr);

  const hasDailyPlanContext =
    plannedTaskIds.length > 0 ||
    plannedHabitIds.length > 0 ||
    (todayDailyPlan?.calendarBlockIds?.length ?? 0) > 0 ||
    (todayDailyPlan?.carryOverTaskIds?.length ?? 0) > 0 ||
    Boolean(primaryFocus);

  const hasUserContext =
    taskRecords.length > 0 ||
    allHabits.length > 0 ||
    allCalendarBlocks.length > 0 ||
    activeGoals.length > 0 ||
    hasDailyPlanContext ||
    meaningfulActivityCountToday > 0 ||
    todayReviewAvailable ||
    yesterdayReviewIncomplete;

  return {
    now,
    hour,
    todayStr,
    yesterdayStr,
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
    userEnergyBand,
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
    totalTaskCount: taskRecords.length,
    totalHabitCount: allHabits.length,
    totalCalendarBlockCount: allCalendarBlocks.length,
    hasUserContext,
    activeCalendarBlock,
    nextCalendarBlock,
    minutesUntilNextBlock,
    availableWindowMinutes,
    todayReviewStatus,
    todayReviewAvailable,
    hasReviewableActivityToday: todayReviewAvailable,
    yesterdayReviewIncomplete,
    needsProfile,
    minutesSinceLastTaskCreated,
    activeCooldownCount: 0,
    selectedCandidateIdentity: null,
    excludedCandidateIdentities: [],
  };
}

export interface ExcludeTarget {
  actionType: SuggestionActionType;
  targetId?: string;
}

function hasMeaningfulUserContext(ctx: Context): boolean {
  return ctx.hasUserContext;
}

function makeNoContextCandidate(): CandidateAction {
  return {
    ruleName: 'no_context_available',
    actionType: 'clear_state',
    command: 'NO CONTEXT AVAILABLE',
    targetLabel: 'Add a task, habit, or calendar block to activate recommendations.',
    reason: 'NOW_WHAT? needs user-created context before it can choose the next action.',
    priority: 12,
    identity: 'state:no_context_available',
  };
}

function makeNoActionReadyCandidate(): CandidateAction {
  return {
    ruleName: 'no_action_ready',
    actionType: 'clear_state',
    command: 'NO ACTION READY',
    targetLabel: 'Current recommendations are in cooldown.',
    reason: 'Dismissed actions will return when their cooldown expires or when new context is added.',
    priority: 12,
    identity: 'state:no_action_ready',
  };
}

function candidateIdentity(candidate: CandidateAction, ctx: Context): string {
  switch (candidate.actionType) {
    case 'start_task':
      return `task:start:${candidate.targetId ?? 'unknown'}`;
    case 'complete_habit':
      return `habit:complete:${candidate.targetId ?? 'unknown'}`;
    case 'log_water':
      return 'lifestyle:water';
    case 'log_meal':
      return 'lifestyle:meal';
    case 'move':
      return 'lifestyle:movement';
    case 'rest':
      return 'lifestyle:rest';
    case 'begin_focus':
      return 'focus:begin';
    case 'review_day':
      return `review:daily:${candidate.ruleName === 'yesterday_review_incomplete' ? ctx.yesterdayStr : ctx.todayStr}`;
    case 'plan_tomorrow':
      return `plan:tomorrow:${ctx.todayStr}`;
    case 'acknowledge_block':
      return `calendar:block:${candidate.targetId ?? 'active'}`;
    case 'micro_action':
      return `micro:${candidate.microActionId ?? candidate.ruleName}`;
    case 'clear_state':
      return `state:${candidate.ruleName}`;
    default:
      return `${candidate.actionType}:${candidate.targetId ?? candidate.ruleName}`;
  }
}

function withCandidateIdentities(candidates: CandidateAction[], ctx: Context): CandidateAction[] {
  return candidates.map(candidate => ({
    ...candidate,
    identity: candidate.identity ?? candidateIdentity(candidate, ctx),
  }));
}

function snapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' ? value : null;
}

function snapshotNumber(snapshot: Record<string, unknown>, key: string): number | null {
  const value = snapshot[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function suggestionIdentityFromFields(suggestion: Suggestion): string | null {
  switch (suggestion.actionType) {
    case 'start_task':
      return suggestion.targetId ? `task:start:${suggestion.targetId}` : null;
    case 'complete_habit':
      return suggestion.targetId ? `habit:complete:${suggestion.targetId}` : null;
    case 'log_water':
      return 'lifestyle:water';
    case 'log_meal':
      return 'lifestyle:meal';
    case 'move':
      return 'lifestyle:movement';
    case 'rest':
      return 'lifestyle:rest';
    case 'begin_focus':
      return 'focus:begin';
    case 'acknowledge_block':
      return suggestion.targetId ? `calendar:block:${suggestion.targetId}` : null;
    case 'review_day': {
      const currentDate = snapshotString(suggestion.contextSnapshot ?? {}, 'currentDate');
      return `review:daily:${currentDate ?? suggestion.createdAt.slice(0, 10)}`;
    }
    case 'plan_tomorrow':
      return `plan:tomorrow:${suggestion.createdAt.slice(0, 10)}`;
    case 'micro_action': {
      const microActionId = snapshotString(suggestion.contextSnapshot ?? {}, 'microActionId');
      return microActionId ? `micro:${microActionId}` : null;
    }
    case 'clear_state':
      return null;
    default:
      return null;
  }
}

function cooldownMsFor(actionType: SuggestionActionType, ruleName?: string | null): number {
  if (ruleName === 'critical_overdue_task') return 20 * MINUTE_MS;
  if (ruleName === 'closest_deadline_task') return 30 * MINUTE_MS;
  if (actionType === 'review_day') return 2 * HOUR_MS;
  if (actionType === 'complete_habit') return 45 * MINUTE_MS;
  if (actionType === 'start_task') return 45 * MINUTE_MS;
  if (actionType === 'log_water' || actionType === 'log_meal' || actionType === 'move' || actionType === 'rest') {
    return 3 * HOUR_MS;
  }
  if (actionType === 'acknowledge_block') return 30 * MINUTE_MS;
  if (actionType === 'micro_action') return 2 * HOUR_MS;
  return 45 * MINUTE_MS;
}

function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'later';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function cooldownUntilForSuggestion(suggestion: Suggestion): string {
  const snapshot = suggestion.contextSnapshot ?? {};
  const storedUntil = snapshotString(snapshot, 'cooldownUntil');
  if (storedUntil && !Number.isNaN(new Date(storedUntil).getTime())) return storedUntil;

  const dismissedAt = snapshotString(snapshot, 'dismissedAt') ?? suggestion.createdAt;
  const baseMs = new Date(dismissedAt).getTime();
  const safeBaseMs = Number.isNaN(baseMs) ? Date.now() : baseMs;
  const ruleName = snapshotString(snapshot, 'ruleApplied');
  const cooldownHours = snapshotNumber(snapshot, 'cooldownHours');
  const cooldownMs = cooldownHours !== null
    ? cooldownHours * HOUR_MS
    : cooldownMsFor(suggestion.actionType, ruleName);
  return new Date(safeBaseMs + cooldownMs).toISOString();
}

async function getActiveCooldowns(now: Date): Promise<Map<string, ActiveCooldown>> {
  const dismissedSuggestions = await db.suggestions.where('status').equals('dismissed').toArray();
  const nowMs = now.getTime();
  const cooldowns = new Map<string, ActiveCooldown>();

  for (const suggestion of dismissedSuggestions) {
    const snapshot = suggestion.contextSnapshot ?? {};
    const identity =
      snapshotString(snapshot, 'cooldownIdentity') ??
      snapshotString(snapshot, 'selectedCandidateIdentity') ??
      suggestionIdentityFromFields(suggestion);

    if (!identity) continue;

    const until = cooldownUntilForSuggestion(suggestion);
    const untilMs = new Date(until).getTime();
    if (Number.isNaN(untilMs) || untilMs <= nowMs) continue;

    const previous = cooldowns.get(identity);
    if (!previous || new Date(previous.until).getTime() < untilMs) {
      cooldowns.set(identity, {
        identity,
        until,
        reason: `cooling down until ${formatLocalTime(until)}`,
      });
    }
  }

  return cooldowns;
}

function filterCandidatesForCooldown(
  candidates: CandidateAction[],
  cooldowns: Map<string, ActiveCooldown>
): CooldownFilterResult {
  const available: CandidateAction[] = [];
  const coolingCandidates: CandidateAction[] = [];
  const excludedCandidateIdentities: string[] = [];

  for (const candidate of candidates) {
    const identity = candidate.identity;
    const cooldown = identity ? cooldowns.get(identity) : undefined;

    if (cooldown && !STATE_RULES.has(candidate.ruleName) && !COOLDOWN_OVERRIDE_RULES.has(candidate.ruleName)) {
      coolingCandidates.push({
        ...candidate,
        cooldownReason: cooldown.reason,
        cooldownUntil: cooldown.until,
      });
      excludedCandidateIdentities.push(`${identity} (${cooldown.reason})`);
      continue;
    }

    available.push(candidate);
  }

  return {
    candidates: available,
    coolingCandidates,
    excludedCandidateIdentities,
    activeCooldownCount: cooldowns.size,
  };
}

function shouldPersistSuggestion(action: CandidateAction): boolean {
  return !STATE_RULES.has(action.ruleName);
}

function profileState(ctx: Context): StateType {
  return ctx.latestMoodState.toLowerCase() as StateType;
}

function profileCapacity(ctx: Context): ProfileFocusCapacity {
  return ctx.currentFocusCapacity.toLowerCase() as ProfileFocusCapacity;
}

function microConditionIsMet(condition: string, ctx: Context): boolean {
  const hasUrgentWork = ctx.pendingTasks.some(task =>
    task.priority === 'critical' || Boolean(task.dueDate && task.dueDate <= ctx.todayStr)
  );

  switch (condition) {
    case 'always': return true;
    case 'user_context': return ctx.hasUserContext;
    case 'no_tasks': return ctx.totalTaskCount === 0;
    case 'no_habits': return ctx.totalHabitCount === 0;
    case 'no_calendar_blocks': return ctx.totalCalendarBlockCount === 0;
    case 'needs_profile_incomplete': return !ctx.needsProfile.onboardingCompletedAt;
    case 'pending_tasks': return ctx.pendingTasks.length > 0;
    case 'planned_tasks': return ctx.plannedTaskIds.some(id => ctx.pendingTasks.some(task => task.id === id));
    case 'active_habit_window': return ctx.pendingHabitsInWindow.length > 0;
    case 'review_available': return ctx.todayReviewAvailable || ctx.yesterdayReviewIncomplete;
    case 'goals_available': return ctx.activeGoals.length > 0;
    case 'calendar_available': return ctx.totalCalendarBlockCount > 0;
    case 'activity_exists': return ctx.meaningfulActivityCountToday > 0;
    case 'no_recent_task': return ctx.minutesSinceLastTaskCreated >= 6 * 60;
    case 'no_urgent_work': return !hasUrgentWork;
    case 'no_urgent_block': return !ctx.activeCalendarBlock && ctx.availableWindowMinutes >= 10;
    default: return false;
  }
}

function getMicroActionCandidates(
  ctx: Context,
  isExcluded: (actionType: SuggestionActionType, targetId?: string) => boolean
): CandidateAction[] {
  const selectedNeeds = ctx.needsProfile.selectedNeeds;
  const state = profileState(ctx);
  const capacity = profileCapacity(ctx);
  const energyBand = ctx.userEnergyBand ?? 'neutral';

  return MICRO_ACTIONS
    .filter(template => {
      if (isExcluded('micro_action', template.id)) return false;
      if (!template.stateTags.includes(state)) return false;
      if (!template.capacityTags.includes(capacity)) return false;
      if (!template.energyBandTags.includes(energyBand)) return false;
      if (!template.eligibleWhen.every(condition => microConditionIsMet(condition, ctx))) return false;

      if (selectedNeeds.length > 0) {
        if (!template.needsTags.some(need => selectedNeeds.includes(need))) return false;
      } else if (!['setup', 'planning', 'maintenance', 'review'].includes(template.category)) {
        return false;
      }

      if (
        ctx.needsProfile.lowEnergyPreference === 'critical_only' &&
        ctx.pendingTasks.length > 0 &&
        ['recovery', 'movement', 'maintenance'].includes(template.category)
      ) {
        return false;
      }

      return true;
    })
    .map(template => ({
      ruleName: `micro_${template.category}`,
      actionType: 'micro_action' as const,
      command: template.title,
      targetLabel: template.body,
      reason: 'A bounded action that fits current context.',
      priority: 10.5,
      identity: `micro:${template.id}`,
      microActionId: template.id,
      actionIntent: template.actionIntent,
    }));
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
  if (ctx.hour >= 20 && ctx.todayReviewAvailable && allPlannedDone && ctx.todayReviewStatus !== 'complete' && !isExcluded('review_day')) {
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
  if (ctx.hour >= 20 && ctx.todayReviewAvailable && ctx.todayReviewStatus !== 'complete' && !isExcluded('review_day')) {
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

  const hardRulePresent = candidates.some(candidate => isHardRuleCandidate(candidate, ctx));
  if (!hardRulePresent) {
    candidates.push(...getMicroActionCandidates(ctx, isExcluded));
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

  return withCandidateIdentities(applyStateAdjustments(candidates, ctx), ctx);
}

export function rankCandidateActions(candidates: CandidateAction[]): CandidateAction | null {
  return candidates.length > 0 ? candidates[0] : null;
}

export async function persistSuggestion(s: Suggestion): Promise<void> {
  await db.suggestions.add(s);
}

async function getRecentCandidateIdentities(now: Date): Promise<string[]> {
  const since = now.getTime() - 24 * HOUR_MS;
  const recent = await db.suggestions.orderBy('createdAt').reverse().limit(16).toArray();
  return recent
    .filter(suggestion => suggestion.status !== 'dismissed' && new Date(suggestion.createdAt).getTime() >= since)
    .map(suggestion =>
      snapshotString(suggestion.contextSnapshot ?? {}, 'selectedCandidateIdentity') ??
      suggestionIdentityFromFields(suggestion)
    )
    .filter((identity): identity is string => Boolean(identity));
}

function suggestionFromCandidate(
  action: CandidateAction,
  context: Context,
  isAlternative = false
): Suggestion {
  const microAction = action.microActionId ? getMicroActionById(action.microActionId) : undefined;
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    actionType: action.actionType,
    targetId: action.targetId,
    command: action.command,
    targetLabel: action.targetLabel,
    reason: action.reason,
    status: 'shown',
    contextSnapshot: {
      currentTime: context.now.toISOString(),
      currentDate: context.todayStr,
      pendingTaskCount: context.pendingTasks.length,
      totalTaskCount: context.totalTaskCount,
      totalHabitCount: context.totalHabitCount,
      totalCalendarBlockCount: context.totalCalendarBlockCount,
      overdueTaskCount: context.criticalOverdueTasks.length,
      incompleteHabitCount: context.pendingHabitsAny.length,
      meaningfulActivityCountToday: context.meaningfulActivityCountToday,
      hasUserContext: context.hasUserContext,
      hasReviewableActivityToday: context.hasReviewableActivityToday,
      latestEnergy: context.lastEnergyValue,
      userEnergyBand: context.userEnergyBand,
      latestMood: context.lastMoodValue,
      latestMoodState: context.latestMoodState,
      latestEnergyLevel: context.latestEnergyLevel,
      currentFocusCapacity: context.currentFocusCapacity,
      selectedNeeds: context.needsProfile.selectedNeeds,
      priorityMode: context.needsProfile.priorityMode,
      lowEnergyPreference: context.needsProfile.lowEnergyPreference,
      waterMlToday: context.waterMlToday,
      minutesSinceLastWater: context.minutesSinceLastWater === Infinity ? null : context.minutesSinceLastWater,
      focusMinutesToday: context.focusMinutesToday,
      restMinutesToday: context.restMinutesToday,
      distractionMinutesToday: context.distractionMinutesToday,
      movementMinutesToday: context.movementMinutesToday,
      activeCooldownCount: context.activeCooldownCount,
      selectedCandidateIdentity: action.identity,
      excludedCandidateIdentities: context.excludedCandidateIdentities,
      ruleApplied: action.ruleName,
      selectedStateAffected: Boolean(action.stateAffected),
      selectedStateAdjustment: action.stateAdjustment ?? 0,
      finalScore: action.scoreBreakdown?.finalScore,
      scoreBreakdown: action.scoreBreakdown,
      supportText: action.supportText,
      isAlternative,
      microActionId: action.microActionId,
      actionIntent: action.actionIntent,
      cooldownHours: microAction?.cooldownHours,
      todayReviewStatus: context.todayReviewStatus,
      todayReviewAvailable: context.todayReviewAvailable,
      yesterdayReviewIncomplete: context.yesterdayReviewIncomplete,
    },
  };
}

function chooseAlternativeCandidates(
  candidates: CandidateAction[],
  primary: CandidateAction,
  ctx: Context
): CandidateAction[] {
  if (isHardRuleCandidate(primary, ctx)) return [];
  const pool = candidates.filter(candidate =>
    !STATE_RULES.has(candidate.ruleName) &&
    candidate.identity !== primary.identity &&
    !candidate.cooldownReason
  );
  const alternatives: CandidateAction[] = [];

  for (const candidate of pool) {
    if (alternatives.length >= 2) break;
    if (alternatives.some(item => item.actionType === candidate.actionType)) continue;
    alternatives.push({ ...candidate, isAlternative: true });
  }

  for (const candidate of pool) {
    if (alternatives.length >= 2) break;
    if (alternatives.some(item => item.identity === candidate.identity)) continue;
    alternatives.push({ ...candidate, isAlternative: true });
  }

  return alternatives;
}

export async function generateRecommendationDeckWithDebugInfo(
  excludeTargets: ExcludeTarget[] = []
): Promise<{
  deck: RecommendationDeck;
  context: Context;
  candidates: CandidateAction[];
}> {
  const shownOnes = await db.suggestions.where('status').equals('shown').toArray();
  await Promise.all(shownOnes.map(s => db.suggestions.update(s.id, { status: 'ignored' })));

  const baseContext = await getCurrentContext();
  const rawCandidates = getCandidateActions(baseContext, excludeTargets);
  const cooldowns = await getActiveCooldowns(baseContext.now);
  const cooldownResult = filterCandidatesForCooldown(rawCandidates, cooldowns);
  const recentIdentities = await getRecentCandidateIdentities(baseContext.now);
  const scoredAvailable = scoreAndRankCandidates(cooldownResult.candidates, baseContext, recentIdentities);
  const scoredCooling = scoreAndRankCandidates(cooldownResult.coolingCandidates, baseContext, recentIdentities);
  const availableActionCandidates = scoredAvailable.filter(candidate => !STATE_RULES.has(candidate.ruleName));

  let action: CandidateAction;
  let deckState: RecommendationDeck['state'];
  if (!baseContext.hasUserContext) {
    action = scoreAndRankCandidates([rawCandidates[0] ?? makeNoContextCandidate()], baseContext)[0];
    deckState = 'no_context';
  } else if (availableActionCandidates.length > 0) {
    action = availableActionCandidates[0];
    deckState = 'ready';
  } else if (cooldownResult.excludedCandidateIdentities.length > 0) {
    action = scoreAndRankCandidates([makeNoActionReadyCandidate()], baseContext)[0];
    deckState = 'cooldown';
  } else {
    action = scoredAvailable[0] ?? scoreAndRankCandidates([makeNoContextCandidate()], baseContext)[0];
    deckState = action.ruleName === 'clear_state' ? 'empty' : 'ready';
  }

  action = {
    ...action,
    identity: action.identity ?? candidateIdentity(action, baseContext),
    supportText: action.supportText ?? getCriticalSupportText(action, baseContext),
  };

  const context: Context = {
    ...baseContext,
    activeCooldownCount: cooldownResult.activeCooldownCount,
    selectedCandidateIdentity: action.identity ?? null,
    excludedCandidateIdentities: cooldownResult.excludedCandidateIdentities,
  };

  const alternativeCandidates = deckState === 'ready'
    ? chooseAlternativeCandidates(availableActionCandidates, action, context)
    : [];
  const primary = suggestionFromCandidate(action, context);
  const alternatives = alternativeCandidates.map(candidate => suggestionFromCandidate(candidate, context, true));
  const selectedIdentity = action.identity;
  const debugCandidates = [...scoredAvailable, ...scoredCooling]
    .sort((a, b) => (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0))
    .map(candidate => ({
      ...candidate,
      scoreBreakdown: candidate.scoreBreakdown
        ? { ...candidate.scoreBreakdown, selected: candidate.identity === selectedIdentity }
        : undefined,
    }));
  const debug: CandidateScoreBreakdown[] = debugCandidates.flatMap(candidate =>
    candidate.scoreBreakdown ? [candidate.scoreBreakdown] : []
  );
  const deck: RecommendationDeck = {
    primary,
    alternatives,
    state: deckState,
    supportText: action.supportText,
    pendingCount: context.pendingTasks.length,
    debug,
  };

  if (shouldPersistSuggestion(action)) {
    await persistSuggestion(primary);
  }

  return { deck, context, candidates: debugCandidates };
}

export async function generateWithDebugInfo(excludeTargets: ExcludeTarget[] = []): Promise<{
  suggestion: Suggestion;
  context: Context;
  candidates: CandidateAction[];
}> {
  const { deck, context, candidates } = await generateRecommendationDeckWithDebugInfo(excludeTargets);
  const suggestion = deck.primary ?? suggestionFromCandidate(makeNoContextCandidate(), context);
  return { suggestion, context, candidates };
}

export async function persistAlternativeSuggestion(suggestion: Suggestion): Promise<Suggestion> {
  const shown = await db.suggestions.where('status').equals('shown').toArray();
  await Promise.all(shown.map(item => db.suggestions.update(item.id, { status: 'ignored' })));
  const active: Suggestion = {
    ...suggestion,
    status: 'shown',
    contextSnapshot: {
      ...suggestion.contextSnapshot,
      isAlternative: false,
      selectedFromAlternatives: true,
    },
  };
  await db.suggestions.put(active);
  return active;
}

export async function generateNowWhatSuggestion(): Promise<Suggestion> {
  const { suggestion } = await generateWithDebugInfo();
  return suggestion;
}

export async function acceptSuggestion(id: string) {
  await db.suggestions.update(id, { status: 'accepted' });
}

export async function dismissSuggestion(id: string) {
  const suggestion = await db.suggestions.get(id);
  if (!suggestion) return;

  const snapshot = suggestion.contextSnapshot ?? {};
  const ruleName = snapshotString(snapshot, 'ruleApplied');
  const identity =
    snapshotString(snapshot, 'selectedCandidateIdentity') ??
    suggestionIdentityFromFields(suggestion);
  const dismissedAt = new Date().toISOString();
  const cooldownHours = snapshotNumber(snapshot, 'cooldownHours');
  const cooldownMs = cooldownHours !== null
    ? cooldownHours * HOUR_MS
    : cooldownMsFor(suggestion.actionType, ruleName);
  const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();

  await db.suggestions.update(id, {
    status: 'dismissed',
    contextSnapshot: {
      ...snapshot,
      dismissedAt,
      cooldownUntil,
      cooldownIdentity: identity,
    },
  });
}

export async function completeSuggestion(id: string) {
  await db.suggestions.update(id, { status: 'completed' });
}
