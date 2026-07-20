import { db } from './db';
import {
  getOrCreateNeedsProfile,
  isValidUserEnergyLevel,
  isValidQuietHour,
  NEEDS_PROFILE_ID,
  VALID_LOW_ENERGY_PREFERENCES,
  VALID_NEED_TYPES,
  VALID_PRIORITY_MODES,
  VALID_STATE_TYPES,
} from './needsProfile';
import type { DailyReview, NeedType, NeedsProfile, Reminder } from '../types';

export interface IntegrityIssue {
  type: 'warning' | 'error';
  store: string;
  id: string;
  message: string;
  fixable?: boolean;
  fixLabel?: string;
  fix?: () => Promise<void>;
}

export interface IntegrityReport {
  issues: IntegrityIssue[];
  checkedAt: string;
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

export async function runIntegrityChecks(): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = [];

  const [tasks, habits, goals, calendarBlocks, dailyPlans, dailyReviews, activityLogs, needsProfiles] = await Promise.all([
    db.tasks.toArray(),
    db.habits.toArray(),
    db.goals.toArray(),
    db.calendarBlocks.toArray(),
    db.dailyPlans.toArray(),
    db.dailyReviews.toArray() as Promise<DailyReview[]>,
    db.activityLogs.toArray(),
    db.needsProfiles.toArray() as Promise<NeedsProfile[]>,
  ]);

  const taskIds = new Set(tasks.map(t => t.id));
  const habitIds = new Set(habits.map(h => h.id));
  const goalIds = new Set(goals.map(g => g.id));
  const blockIds = new Set(calendarBlocks.map(b => b.id));

  const defaultNeedsProfile = needsProfiles.find(profile => profile.id === NEEDS_PROFILE_ID);
  if (!defaultNeedsProfile) {
    issues.push({
      type: 'warning',
      store: 'needsProfiles',
      id: NEEDS_PROFILE_ID,
      message: 'Default NeedsProfile is missing.',
      fixable: true,
      fixLabel: 'Create default NeedsProfile',
      fix: async () => {
        await getOrCreateNeedsProfile();
      },
    });
  }

  for (const profile of needsProfiles) {
    const raw = profile as Partial<NeedsProfile> & Record<string, unknown>;
    const selectedNeeds = raw.selectedNeeds;

    if (!Array.isArray(selectedNeeds) || !selectedNeeds.every(value => isOneOf<NeedType>(value, VALID_NEED_TYPES))) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: 'NeedsProfile has invalid selectedNeeds values.',
      });
    }

    if (!isOneOf(raw.priorityMode, VALID_PRIORITY_MODES)) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: `NeedsProfile has invalid priorityMode: "${String(raw.priorityMode)}".`,
      });
    }

    if (!isOneOf(raw.lowEnergyPreference, VALID_LOW_ENERGY_PREFERENCES)) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: `NeedsProfile has invalid lowEnergyPreference: "${String(raw.lowEnergyPreference)}".`,
      });
    }

    if (
      typeof raw.checkInIntervalHours !== 'number' ||
      !Number.isInteger(raw.checkInIntervalHours) ||
      raw.checkInIntervalHours < 1 ||
      raw.checkInIntervalHours > 168
    ) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: 'NeedsProfile has invalid checkInIntervalHours.',
      });
    }

    if (!isValidQuietHour(raw.quietHoursStart)) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: 'NeedsProfile has invalid quietHoursStart.',
      });
    }

    if (!isValidQuietHour(raw.quietHoursEnd)) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: 'NeedsProfile has invalid quietHoursEnd.',
      });
    }

    if (
      raw.stateCheckDismissCount !== undefined &&
      (
        typeof raw.stateCheckDismissCount !== 'number' ||
        !Number.isInteger(raw.stateCheckDismissCount) ||
        raw.stateCheckDismissCount < 0
      )
    ) {
      issues.push({
        type: 'error',
        store: 'needsProfiles',
        id: profile.id,
        message: 'NeedsProfile has invalid stateCheckDismissCount.',
      });
    }

    if (raw.lastStateCheckAt && raw.nextStateCheckAt) {
      const lastMs = new Date(raw.lastStateCheckAt).getTime();
      const nextMs = new Date(raw.nextStateCheckAt).getTime();
      if (!Number.isNaN(lastMs) && !Number.isNaN(nextMs) && nextMs < lastMs) {
        issues.push({
          type: 'warning',
          store: 'needsProfiles',
          id: profile.id,
          message: 'NeedsProfile nextStateCheckAt is earlier than lastStateCheckAt.',
        });
      }
    }
  }

  // ── Goal link integrity ──────────────────────────────────────────────────

  for (const task of tasks) {
    if (!['low', 'medium', 'high'].includes(task.energyRequired)) {
      issues.push({
        type: 'error',
        store: 'tasks',
        id: task.id,
        message: `Task "${task.title}" has an invalid energyRequired value.`,
      });
    }
    if (task.goalId && !goalIds.has(task.goalId)) {
      issues.push({
        type: 'warning', store: 'tasks', id: task.id,
        message: `Task "${task.title}" has goalId pointing to a non-existent goal.`,
      });
    }
  }

  for (const habit of habits) {
    if (!Array.isArray(habit.completionHistory)) {
      issues.push({
        type: 'error', store: 'habits', id: habit.id,
        message: `Habit "${habit.name}" has invalid completion history.`,
      });
    }
    if (habit.goalId && !goalIds.has(habit.goalId)) {
      issues.push({
        type: 'warning', store: 'habits', id: habit.id,
        message: `Habit "${habit.name}" has goalId pointing to a non-existent goal.`,
      });
    }
  }

  for (const goal of goals) {
    const missingTaskIds = (goal.linkedTaskIds || []).filter(id => !taskIds.has(id));
    if (missingTaskIds.length > 0) {
      const snapshot = goal; // capture for closure
      issues.push({
        type: 'warning', store: 'goals', id: goal.id,
        message: `Goal "${goal.title}" has ${missingTaskIds.length} missing linked task ID(s).`,
        fixable: true,
        fixLabel: 'Remove missing task IDs',
        fix: async () => {
          await db.goals.update(snapshot.id, {
            linkedTaskIds: (snapshot.linkedTaskIds || []).filter(id => taskIds.has(id)),
            updatedAt: new Date().toISOString(),
          });
        },
      });
    }

    const missingHabitIds = (goal.linkedHabitIds || []).filter(id => !habitIds.has(id));
    if (missingHabitIds.length > 0) {
      const snapshot = goal;
      issues.push({
        type: 'warning', store: 'goals', id: goal.id,
        message: `Goal "${goal.title}" has ${missingHabitIds.length} missing linked habit ID(s).`,
        fixable: true,
        fixLabel: 'Remove missing habit IDs',
        fix: async () => {
          await db.goals.update(snapshot.id, {
            linkedHabitIds: (snapshot.linkedHabitIds || []).filter(id => habitIds.has(id)),
            updatedAt: new Date().toISOString(),
          });
        },
      });
    }

    // Cross-reference: task/habit points to goal but goal doesn't list it
    for (const task of tasks) {
      if (task.goalId === goal.id && !(goal.linkedTaskIds || []).includes(task.id)) {
        issues.push({
          type: 'warning', store: 'goals', id: goal.id,
          message: `Task "${task.title}" references goal "${goal.title}" but goal's linkedTaskIds does not include it.`,
        });
      }
    }
    for (const habit of habits) {
      if (habit.goalId === goal.id && !(goal.linkedHabitIds || []).includes(habit.id)) {
        issues.push({
          type: 'warning', store: 'goals', id: goal.id,
          message: `Habit "${habit.name}" references goal "${goal.title}" but goal's linkedHabitIds does not include it.`,
        });
      }
    }
  }

  // ── DailyPlan integrity ──────────────────────────────────────────────────

  for (const plan of dailyPlans) {
    const allTaskRefs = [...(plan.plannedTaskIds || []), ...(plan.carryOverTaskIds || [])];
    const uniqueMissingTasks = [...new Set(allTaskRefs.filter(id => !taskIds.has(id)))];
    if (uniqueMissingTasks.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} references ${uniqueMissingTasks.length} task ID(s) that do not exist.`,
      });
    }

    const missingHabits = (plan.plannedHabitIds || []).filter(id => !habitIds.has(id));
    if (missingHabits.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} references ${missingHabits.length} habit ID(s) that do not exist.`,
      });
    }

    const missingBlocks = (plan.calendarBlockIds || []).filter(id => !blockIds.has(id));
    if (missingBlocks.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} references ${missingBlocks.length} calendar block ID(s) that do not exist.`,
      });
    }

    // Duplicate IDs
    const planSnap = plan;
    const taskArr = plan.plannedTaskIds || [];
    if (new Set(taskArr).size < taskArr.length) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} has duplicate planned task IDs.`,
        fixable: true, fixLabel: 'Remove duplicate task IDs',
        fix: async () => {
          await db.dailyPlans.update(planSnap.id, {
            plannedTaskIds: [...new Set(planSnap.plannedTaskIds || [])],
            updatedAt: new Date().toISOString(),
          });
        },
      });
    }

    const habitArr = plan.plannedHabitIds || [];
    if (new Set(habitArr).size < habitArr.length) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} has duplicate planned habit IDs.`,
        fixable: true, fixLabel: 'Remove duplicate habit IDs',
        fix: async () => {
          await db.dailyPlans.update(planSnap.id, {
            plannedHabitIds: [...new Set(planSnap.plannedHabitIds || [])],
            updatedAt: new Date().toISOString(),
          });
        },
      });
    }

    const blockArr = plan.calendarBlockIds || [];
    if (new Set(blockArr).size < blockArr.length) {
      issues.push({
        type: 'warning', store: 'dailyPlans', id: plan.id,
        message: `DailyPlan ${plan.date} has duplicate calendar block IDs.`,
        fixable: true, fixLabel: 'Remove duplicate block IDs',
        fix: async () => {
          await db.dailyPlans.update(planSnap.id, {
            calendarBlockIds: [...new Set(planSnap.calendarBlockIds || [])],
            updatedAt: new Date().toISOString(),
          });
        },
      });
    }
  }

  // ── Calendar block integrity ─────────────────────────────────────────────

  for (const block of calendarBlocks) {
    const startMs = new Date(block.startAt).getTime();
    const endMs = new Date(block.endAt).getTime();
    if (!block.startAt || !block.endAt || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      issues.push({
        type: 'error', store: 'calendarBlocks', id: block.id,
        message: `Calendar block "${block.title}" has an invalid start or end time.`,
      });
    } else if (endMs < startMs) {
      issues.push({
        type: 'warning', store: 'calendarBlocks', id: block.id,
        message: `Calendar block "${block.title}" end time is before start time.`,
      });
    }

    const badTaskIds = (block.convertedTaskIds || []).filter(id => !taskIds.has(id));
    if (badTaskIds.length > 0) {
      issues.push({
        type: 'warning', store: 'calendarBlocks', id: block.id,
        message: `Calendar block "${block.title}" has ${badTaskIds.length} converted task ID(s) that do not exist.`,
      });
    }
  }

  // ── Review integrity ─────────────────────────────────────────────────────

  for (const review of dailyReviews) {
    const missingTasksInReview = (review.completedTaskIds || []).filter(id => !taskIds.has(id));
    if (missingTasksInReview.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyReviews', id: review.id,
        message: `Daily review ${review.date} references ${missingTasksInReview.length} completed task ID(s) that do not exist.`,
      });
    }
    const missingHabitsInReview = (review.completedHabitIds || []).filter(id => !habitIds.has(id));
    if (missingHabitsInReview.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyReviews', id: review.id,
        message: `Daily review ${review.date} references ${missingHabitsInReview.length} completed habit ID(s) that do not exist.`,
      });
    }
    const missingBlocksInReview = (review.calendarBlockIds || []).filter(id => !blockIds.has(id));
    if (missingBlocksInReview.length > 0) {
      issues.push({
        type: 'warning', store: 'dailyReviews', id: review.id,
        message: `Daily review ${review.date} references ${missingBlocksInReview.length} calendar block ID(s) that do not exist.`,
      });
    }
  }

  // ── ActivityLog integrity ────────────────────────────────────────────────

  for (const log of activityLogs) {
    if (!log.createdAt || !Number.isFinite(new Date(log.createdAt).getTime())) {
      issues.push({ type: 'error', store: 'activityLogs', id: log.id, message: 'Activity log has invalid createdAt.' });
    }
    if (!log.type) {
      issues.push({ type: 'error', store: 'activityLogs', id: log.id, message: 'Activity log is missing type.' });
    }
    if (log.relatedTaskId && !taskIds.has(log.relatedTaskId)) {
      issues.push({ type: 'warning', store: 'activityLogs', id: log.id, message: `Activity log "${log.label}" references a task that does not exist.` });
    }
    if (log.relatedHabitId && !habitIds.has(log.relatedHabitId)) {
      issues.push({ type: 'warning', store: 'activityLogs', id: log.id, message: `Activity log "${log.label}" references a habit that does not exist.` });
    }
    if (log.relatedGoalId && !goalIds.has(log.relatedGoalId)) {
      issues.push({ type: 'warning', store: 'activityLogs', id: log.id, message: `Activity log "${log.label}" references a goal that does not exist.` });
    }
    if (log.type === 'state_check') {
      if (!isOneOf(log.state, VALID_STATE_TYPES)) {
        issues.push({
          type: 'error',
          store: 'activityLogs',
          id: log.id,
          message: 'State Check log is missing a valid state.',
        });
      }
      if (
        typeof log.energyLevel !== 'number' ||
        !Number.isInteger(log.energyLevel) ||
        log.energyLevel < 1 ||
        log.energyLevel > 5
      ) {
        issues.push({
          type: 'error',
          store: 'activityLogs',
          id: log.id,
          message: 'State Check log is missing a valid Energy Level from 1 to 5.',
        });
      }
    }
    if ((log.type === 'energy' || log.type === 'mood') && !isValidUserEnergyLevel(log.quantity)) {
      issues.push({
        type: 'error',
        store: 'activityLogs',
        id: log.id,
        message: `${log.type === 'energy' ? 'Energy' : 'Mood'} log must have a value from 1 to 5.`,
      });
    }
    if (
      ['focus', 'exercise', 'rest', 'distraction'].includes(log.type) &&
      (
        typeof log.durationMinutes !== 'number' ||
        !Number.isInteger(log.durationMinutes) ||
        log.durationMinutes < 1
      )
    ) {
      issues.push({
        type: 'error',
        store: 'activityLogs',
        id: log.id,
        message: `${log.type} log must have a positive whole-minute duration.`,
      });
    }
  }

  // ── Reminder integrity ───────────────────────────────────────────────────

  const reminders = await db.reminders.toArray() as Reminder[];
  const validTypes = new Set([
    'task_due', 'habit_window', 'calendar_block', 'planned_focus',
    'daily_review', 'previous_review', 'hydration', 'movement', 'manual', 'custom',
  ]);
  const validStatuses = new Set(['scheduled', 'sent', 'dismissed', 'completed', 'cancelled']);

  for (const r of reminders) {
    if (!r.type || !validTypes.has(r.type)) {
      issues.push({ type: 'error', store: 'reminders', id: r.id, message: `Reminder has invalid or missing type: "${r.type}".` });
    }
    if (!r.scheduledAt || !Number.isFinite(new Date(r.scheduledAt).getTime())) {
      issues.push({ type: 'error', store: 'reminders', id: r.id, message: `Reminder "${r.title}" has invalid scheduledAt.` });
    }
    if (!r.status || !validStatuses.has(r.status)) {
      issues.push({ type: 'error', store: 'reminders', id: r.id, message: `Reminder "${r.title}" has invalid status: "${r.status}".` });
    }
    if (r.targetId) {
      if (r.targetType === 'task' && !taskIds.has(r.targetId)) {
        const snap = r;
        issues.push({
          type: 'warning', store: 'reminders', id: r.id,
          message: `Reminder "${r.title}" references a task that does not exist.`,
          fixable: true, fixLabel: 'Cancel reminder',
          fix: async () => {
            await db.reminders.update(snap.id, { status: 'cancelled', updatedAt: new Date().toISOString() } as never);
          },
        });
      }
      if (r.targetType === 'habit' && !habitIds.has(r.targetId)) {
        const snap = r;
        issues.push({
          type: 'warning', store: 'reminders', id: r.id,
          message: `Reminder "${r.title}" references a habit that does not exist.`,
          fixable: true, fixLabel: 'Cancel reminder',
          fix: async () => {
            await db.reminders.update(snap.id, { status: 'cancelled', updatedAt: new Date().toISOString() } as never);
          },
        });
      }
      if (r.targetType === 'calendarBlock' && !blockIds.has(r.targetId)) {
        const snap = r;
        issues.push({
          type: 'warning', store: 'reminders', id: r.id,
          message: `Reminder "${r.title}" references a calendar block that does not exist.`,
          fixable: true, fixLabel: 'Cancel reminder',
          fix: async () => {
            await db.reminders.update(snap.id, { status: 'cancelled', updatedAt: new Date().toISOString() } as never);
          },
        });
      }
    }
  }

  return { issues, checkedAt: new Date().toISOString() };
}
