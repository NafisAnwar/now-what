import { getMicroActionById } from './microActions';
import {
  getTaskCategoryGroup,
  getTaskCategoryNeed,
} from '../constants/categories';
import type { CandidateAction, Context } from './nowWhat';
import type {
  CandidateScoreBreakdown,
  NeedType,
  Task,
  UserEnergyBand,
} from '../types';

const HARD_RULE_SCORES: Record<string, number> = {
  active_calendar_block: 1000,
  critical_overdue_task: 900,
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getUserEnergyBand(value: number | null): UserEnergyBand | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 2) return 'low';
  if (value >= 4) return 'high';
  return 'neutral';
}

function candidateTask(candidate: CandidateAction, ctx: Context): Task | undefined {
  if (candidate.actionType !== 'start_task' || !candidate.targetId) return undefined;
  return ctx.pendingTasks.find(task => task.id === candidate.targetId);
}

function isAdminTask(task: Task): boolean {
  return getTaskCategoryGroup(task.category) === 'life_admin';
}

function isCreativeTask(task: Task): boolean {
  return getTaskCategoryGroup(task.category) === 'creative_projects';
}

function isHealthTask(task: Task): boolean {
  return getTaskCategoryGroup(task.category) === 'health_energy';
}

function taskMinutes(task: Task): number | null {
  return typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes)
    ? task.estimatedMinutes
    : null;
}

function dueTimestamp(task: Task): number | null {
  if (!task.dueDate) return null;
  const value = `${task.dueDate}T${task.dueTime || '23:59'}:00`;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isHardRuleCandidate(candidate: CandidateAction, ctx: Context): boolean {
  if (candidate.ruleName in HARD_RULE_SCORES) return true;

  const task = candidateTask(candidate, ctx);
  if (candidate.ruleName === 'closest_deadline_task' && task) {
    const dueAt = dueTimestamp(task);
    return Boolean(
      task.dueDate && task.dueDate <= ctx.todayStr ||
      dueAt !== null && dueAt - ctx.now.getTime() <= 4 * 60 * 60 * 1000
    );
  }

  if (candidate.ruleName === 'habit_in_window' && candidate.targetId) {
    const habit = ctx.pendingHabitsInWindow.find(item => item.id === candidate.targetId);
    if (!habit?.timeWindowEnd) return false;
    const [hours, minutes] = habit.timeWindowEnd.split(':').map(Number);
    const end = new Date(ctx.now);
    end.setHours(hours, minutes, 0, 0);
    const minutesRemaining = (end.getTime() - ctx.now.getTime()) / 60000;
    return minutesRemaining >= 0 && minutesRemaining <= 30;
  }

  return false;
}

function hardRuleScore(candidate: CandidateAction, ctx: Context): number {
  if (candidate.ruleName in HARD_RULE_SCORES) return HARD_RULE_SCORES[candidate.ruleName];
  if (!isHardRuleCandidate(candidate, ctx)) return 0;
  if (candidate.ruleName === 'closest_deadline_task') return 800;
  if (candidate.ruleName === 'habit_in_window') return 700;
  return 0;
}

function urgencyScore(candidate: CandidateAction, ctx: Context, task?: Task): number {
  let score = 0;
  if (task) {
    if (task.priority === 'critical') score += 24;
    else if (task.priority === 'high') score += 13;
    else if (task.priority === 'medium') score += 5;

    if (task.dueDate) {
      if (task.dueDate < ctx.todayStr) score += 34;
      else if (task.dueDate === ctx.todayStr) score += 28;
      else {
        const dueAt = dueTimestamp(task);
        if (dueAt !== null) {
          const days = (dueAt - ctx.now.getTime()) / (24 * 60 * 60 * 1000);
          if (days <= 1) score += 18;
          else if (days <= 3) score += 10;
          else if (days <= 7) score += 5;
        }
      }
    }
  }

  if (candidate.ruleName === 'habit_in_window') score += 12;
  if (candidate.ruleName === 'yesterday_review_incomplete') score += 5;
  return score;
}

function candidateNeeds(candidate: CandidateAction, task?: Task): Set<NeedType> {
  const needs = new Set<NeedType>();
  const microAction = candidate.microActionId ? getMicroActionById(candidate.microActionId) : undefined;
  microAction?.needsTags.forEach(need => needs.add(need));

  if (task) {
    const categoryNeed = getTaskCategoryNeed(task.category);
    if (categoryNeed) needs.add(categoryNeed);
  }

  if (candidate.actionType === 'complete_habit') needs.add('habit_consistency');
  if (candidate.actionType === 'log_water' || candidate.actionType === 'move' || candidate.actionType === 'rest') needs.add('health_energy');
  if (candidate.actionType === 'review_day' || candidate.actionType === 'plan_tomorrow') needs.add('life_admin');
  if (candidate.actionType === 'begin_focus') needs.add('school_work');
  return needs;
}

function needsAndPriorityScore(candidate: CandidateAction, ctx: Context, task?: Task): number {
  const profile = ctx.needsProfile;
  const tags = candidateNeeds(candidate, task);
  let score = profile.selectedNeeds.reduce((total, need) => total + (tags.has(need) ? 7 : 0), 0);
  const minutes = task ? taskMinutes(task) : null;

  switch (profile.priorityMode) {
    case 'deadline':
      if (task?.dueDate) score += task.dueDate <= ctx.todayStr ? 14 : 8;
      break;
    case 'critical':
      if (task?.priority === 'critical') score += 14;
      else if (task?.priority === 'high') score += 8;
      break;
    case 'easy_start':
      if (minutes !== null && minutes <= 30) score += 10;
      if (candidate.actionType === 'micro_action' && getMicroActionById(candidate.microActionId || '')?.category === 'low_energy') score += 7;
      break;
    case 'daily_focus':
      if (task && ctx.plannedTaskIds.includes(task.id)) score += 12;
      if (task && ctx.primaryFocus && task.title.toLowerCase().includes(ctx.primaryFocus.toLowerCase())) score += 7;
      break;
    case 'energy_match':
      if (ctx.userEnergyBand !== null) score += 5;
      break;
  }

  return score;
}

function taskEnergyFit(task: Task | undefined, ctx: Context): number | undefined {
  if (!task || ctx.lastEnergyValue === null) return task ? 0 : undefined;
  const energy = Math.max(1, Math.min(5, Math.round(ctx.lastEnergyValue)));
  const requirement = task.energyRequired || 'medium';
  const matrix: Record<number, Record<'low' | 'medium' | 'high', number>> = {
    1: { low: 14, medium: -7, high: -20 },
    2: { low: 10, medium: 3, high: -11 },
    3: { low: 1, medium: 4, high: 0 },
    4: { low: 0, medium: 5, high: 8 },
    5: { low: 0, medium: 5, high: 14 },
  };
  let score = matrix[energy][requirement];
  const minutes = taskMinutes(task);
  const urgent = task.priority === 'critical' || Boolean(task.dueDate && task.dueDate <= ctx.todayStr);

  if (energy <= 2 && minutes !== null && minutes <= 30) score += 6;
  if (energy <= 2 && minutes !== null && minutes >= 60 && requirement === 'high' && !urgent) score -= 10;
  if (energy >= 4 && requirement === 'high' && (ctx.plannedTaskIds.includes(task.id) || task.goalId)) score += 6;
  return score;
}

function userEnergyFit(candidate: CandidateAction, ctx: Context, task?: Task): number {
  if (ctx.lastEnergyValue === null) return 0;
  const energy = Math.max(1, Math.min(5, Math.round(ctx.lastEnergyValue)));
  const microAction = candidate.microActionId ? getMicroActionById(candidate.microActionId) : undefined;
  const minutes = task ? taskMinutes(task) : null;
  let score = 0;

  if (energy <= 2) {
    if (task && minutes !== null && minutes <= 30) score += 8;
    if (task && isAdminTask(task)) score += 7;
    if (microAction && ['low_energy', 'admin', 'recovery', 'maintenance'].includes(microAction.category)) score += 8;
    if (candidate.actionType === 'rest') score += 6;
  } else if (energy >= 4) {
    if (task && ctx.plannedTaskIds.includes(task.id)) score += energy === 5 ? 10 : 7;
    if (task?.goalId) score += energy === 5 ? 9 : 6;
    if (task && (task.priority === 'high' || task.priority === 'critical')) score += energy === 5 ? 9 : 6;
    if (task && isCreativeTask(task)) score += energy === 5 ? 7 : 4;
    if (microAction && ['focus', 'creative'].includes(microAction.category)) score += energy === 5 ? 8 : 5;
  }

  return score;
}

function lowEnergyPreferenceScore(candidate: CandidateAction, ctx: Context, task?: Task): number {
  const lowContext = ctx.userEnergyBand === 'low' || ['LOW', 'STRESSED', 'OVERLOADED'].includes(ctx.latestMoodState);
  if (!lowContext) return 0;
  const minutes = task ? taskMinutes(task) : null;
  const microAction = candidate.microActionId ? getMicroActionById(candidate.microActionId) : undefined;

  switch (ctx.needsProfile.lowEnergyPreference) {
    case 'short_tasks': return task && minutes !== null && minutes <= 30 ? 9 : 0;
    case 'admin': return task && isAdminTask(task) || microAction?.category === 'admin' ? 9 : 0;
    case 'recovery': return microAction?.category === 'recovery' || candidate.actionType === 'rest' ? 9 : 0;
    case 'health': return microAction && ['movement', 'recovery', 'maintenance'].includes(microAction.category) || ['log_water', 'move', 'rest'].includes(candidate.actionType) ? 8 : 0;
    case 'critical_only':
      if (ctx.pendingTasks.length > 0 && task?.priority !== 'critical' && ['log_water', 'move', 'rest', 'micro_action'].includes(candidate.actionType)) return -16;
      return 0;
  }
}

function stateFit(candidate: CandidateAction, ctx: Context, task?: Task): number {
  let score = (candidate.stateAdjustment ?? 0) * 3;
  const minutes = task ? taskMinutes(task) : null;
  const microAction = candidate.microActionId ? getMicroActionById(candidate.microActionId) : undefined;
  const state = ctx.latestMoodState.toLowerCase();
  if (microAction) score += microAction.stateTags.includes(state as never) ? 4 : -6;

  if (task) {
    if (ctx.latestMoodState === 'CLEAR') {
      if (ctx.plannedTaskIds.includes(task.id)) score += 7;
      if (task.goalId) score += 5;
      if (minutes !== null && minutes >= 45 && ctx.lastEnergyValue !== null && ctx.lastEnergyValue >= 4) score += 5;
    } else if (ctx.latestMoodState === 'STRESSED') {
      if (minutes !== null && minutes <= 30) score += 7;
      if (minutes !== null && minutes >= 60 && task.priority !== 'critical') score -= 8;
    } else if (ctx.latestMoodState === 'RESTLESS') {
      if (isHealthTask(task)) score += 7;
      if (minutes !== null && minutes <= 25) score += 4;
    } else if (ctx.latestMoodState === 'OVERLOADED') {
      if (task.energyRequired === 'low') score += 8;
      if (minutes !== null && minutes <= 30) score += 7;
      if (minutes !== null && minutes >= 60 && task.priority !== 'critical') score -= 12;
    }
  }

  return score;
}

function timeFit(candidate: CandidateAction, ctx: Context, task?: Task): number {
  if (task) {
    const minutes = taskMinutes(task);
    if (minutes === null) return 0;
    if (minutes <= ctx.availableWindowMinutes) return 6;
    return task.priority === 'critical' ? 0 : -14;
  }

  const microAction = candidate.microActionId ? getMicroActionById(candidate.microActionId) : undefined;
  if (microAction?.id === 'focus_25' && ctx.availableWindowMinutes < 25) return -8;
  if (microAction?.id === 'focus_10' && ctx.availableWindowMinutes >= 10) return 3;
  return 0;
}

function explanationParts(
  candidate: CandidateAction,
  ctx: Context,
  scores: { needs: number; userEnergy: number; taskEnergy?: number; time: number }
): string[] {
  const parts: string[] = [];
  if (ctx.lastEnergyValue !== null && scores.userEnergy + (scores.taskEnergy ?? 0) >= 8) {
    if (ctx.userEnergyBand === 'low') parts.push('Energy level is low. Suggesting a short low-friction action.');
    if (ctx.userEnergyBand === 'high') parts.push('Energy level is high. Suggesting planned or high-value work.');
  }
  if (scores.needs >= 7) parts.push('Matches your recommendation profile.');
  if (scores.time >= 5 && candidate.actionType === 'start_task') parts.push('Fits available time.');
  return parts;
}

export function scoreCandidate(
  candidate: CandidateAction,
  ctx: Context,
  recentIdentities: string[] = []
): CandidateAction {
  const task = candidateTask(candidate, ctx);
  const hardScore = hardRuleScore(candidate, ctx);
  const basePriority = candidate.basePriority ?? candidate.priority;
  const baseScore = Math.max(0, 14 - basePriority) * 5 + hardScore;
  const urgency = urgencyScore(candidate, ctx, task);
  const needs = needsAndPriorityScore(candidate, ctx, task) + lowEnergyPreferenceScore(candidate, ctx, task);
  const userEnergy = userEnergyFit(candidate, ctx, task);
  const taskEnergy = taskEnergyFit(task, ctx);
  const state = stateFit(candidate, ctx, task);
  const time = timeFit(candidate, ctx, task);
  const cooldownPenalty = candidate.cooldownReason ? -1000 : 0;
  const identity = candidate.identity ?? `${candidate.actionType}:${candidate.targetId ?? candidate.ruleName}`;
  const repeats = recentIdentities.filter(value => value === identity).length;
  const varietyPenalty = isHardRuleCandidate(candidate, ctx) ? 0 : -Math.min(18, repeats * 7);
  const parts = explanationParts(candidate, ctx, { needs, userEnergy, taskEnergy, time });
  const finalScore = baseScore + urgency + needs + userEnergy + (taskEnergy ?? 0) + state + time + cooldownPenalty + varietyPenalty;
  const breakdown: CandidateScoreBreakdown = {
    candidateIdentity: identity,
    ruleName: candidate.ruleName,
    actionType: candidate.actionType,
    targetLabel: candidate.targetLabel,
    baseScore: round(baseScore),
    urgencyScore: round(urgency),
    needsScore: round(needs),
    userEnergyFitScore: round(userEnergy),
    ...(taskEnergy !== undefined ? { taskEnergyFitScore: round(taskEnergy) } : {}),
    stateFitScore: round(state),
    timeFitScore: round(time),
    cooldownPenalty,
    varietyPenalty,
    finalScore: round(finalScore),
    explanationParts: parts,
    ...(candidate.cooldownReason ? { excludedReason: candidate.cooldownReason } : {}),
  };

  return {
    ...candidate,
    identity,
    scoreBreakdown: breakdown,
    supportText: candidate.supportText,
    reason: parts.length > 0
      ? `${candidate.reason}${candidate.reason.endsWith('.') ? '' : '.'} ${parts.slice(0, 2).join(' ')}`
      : candidate.reason,
  };
}

export function scoreAndRankCandidates(
  candidates: CandidateAction[],
  ctx: Context,
  recentIdentities: string[] = []
): CandidateAction[] {
  return candidates
    .map(candidate => scoreCandidate(candidate, ctx, recentIdentities))
    .sort((a, b) => {
      const scoreDiff = (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (a.identity ?? '').localeCompare(b.identity ?? '');
    });
}

export function getCriticalSupportText(candidate: CandidateAction, ctx: Context): string | undefined {
  if (candidate.actionType === 'start_task' && candidate.targetId && ctx.pendingTasks.some(task => task.id === candidate.targetId && task.priority === 'critical')) {
    return undefined;
  }
  const critical = ctx.pendingTasks
    .filter(task => task.priority === 'critical')
    .sort((a, b) => `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`.localeCompare(`${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`))[0];
  if (!critical) return undefined;
  const due = critical.dueDate
    ? `${critical.dueDate}${critical.dueTime ? ` ${critical.dueTime}` : ''}`
    : 'without a due time';
  return `Critical task pending: ${critical.title} due ${due}.`;
}
