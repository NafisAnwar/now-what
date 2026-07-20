import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

function makeTask(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: 'QA task',
    category: 'Work',
    priority: 'medium',
    status: 'pending',
    estimatedMinutes: 30,
    repeatRule: { type: 'none' },
    energyRequired: 'medium',
    carryOverHistory: [],
    missedCount: 0,
    createdAt: '2026-07-12T08:00:00.000Z',
    updatedAt: '2026-07-12T08:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  const now = new Date('2026-07-12T10:00:00');
  const needsProfile = {
    id: 'default',
    selectedNeeds: [],
    priorityMode: 'easy_start',
    lowEnergyPreference: 'short_tasks',
    checkInEnabled: false,
    checkInIntervalHours: 6,
    quietHoursStart: '23:00',
    quietHoursEnd: '08:00',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    now,
    hour: 10,
    todayStr: '2026-07-12',
    yesterdayStr: '2026-07-11',
    pendingTasks: [],
    criticalOverdueTasks: [],
    tasksWithDeadlineToday: [],
    highPriorityTasks: [],
    completedTasksToday: 0,
    meaningfulActivityCountToday: 0,
    pendingHabitsInWindow: [],
    pendingHabitsAny: [],
    waterMlToday: 0,
    focusMinutesToday: 0,
    restMinutesToday: 0,
    movementMinutesToday: 0,
    distractionMinutesToday: 0,
    lastWaterAt: null,
    minutesSinceLastWater: Infinity,
    lastEnergyValue: null,
    userEnergyBand: null,
    lastMoodValue: null,
    latestMoodState: 'NEUTRAL',
    latestEnergyLevel: null,
    currentFocusCapacity: 'NORMAL',
    lastFocusEndAt: null,
    minutesSinceLastFocus: Infinity,
    activeGoals: [],
    todayDailyPlan: null,
    plannedTaskIds: [],
    plannedHabitIds: [],
    goalLinkedPendingTasks: [],
    primaryFocus: null,
    todaysCalendarBlocks: [],
    totalTaskCount: 0,
    totalHabitCount: 0,
    totalCalendarBlockCount: 0,
    hasUserContext: true,
    activeCalendarBlock: null,
    nextCalendarBlock: null,
    minutesUntilNextBlock: Infinity,
    availableWindowMinutes: 480,
    todayReviewStatus: 'not_started',
    todayReviewAvailable: false,
    hasReviewableActivityToday: false,
    yesterdayReviewIncomplete: false,
    needsProfile,
    minutesSinceLastTaskCreated: Infinity,
    activeCooldownCount: 0,
    selectedCandidateIdentity: null,
    excludedCandidateIdentities: [],
    ...overrides,
    needsProfile: { ...needsProfile, ...(overrides.needsProfile ?? {}) },
  };
}

function taskCandidate(task, ruleName = 'general_pending_task') {
  return {
    ruleName,
    actionType: 'start_task',
    targetId: task.id,
    command: 'START TASK',
    targetLabel: task.title,
    reason: 'Pending task available.',
    priority: 9,
    identity: `task:start:${task.id}`,
  };
}

function ranked(engine, scoring, context) {
  return scoring.scoreAndRankCandidates(engine.getCandidateActions(context), context);
}

function fakeTable(records = []) {
  return { toArray: async () => records };
}

function makeIntegrityDb({ tasks = [], habits = [], calendarBlocks = [], activityLogs = [], reminders = [], needsProfiles = [] } = {}) {
  return {
    close: () => undefined,
    tasks: fakeTable(tasks),
    habits: fakeTable(habits),
    goals: fakeTable(),
    calendarBlocks: fakeTable(calendarBlocks),
    activityLogs: fakeTable(activityLogs),
    dailyPlans: fakeTable(),
    dailyReviews: fakeTable(),
    weeklyReviews: fakeTable(),
    settings: fakeTable(),
    suggestions: fakeTable(),
    reminders: fakeTable(reminders),
    needsProfiles: fakeTable(needsProfiles),
  };
}

try {
  const engine = await server.ssrLoadModule('/src/engine/nowWhat.ts');
  const scoring = await server.ssrLoadModule('/src/engine/recommendationScoring.ts');
  const microActions = await server.ssrLoadModule('/src/engine/microActions.ts');
  const categories = await server.ssrLoadModule('/src/constants/categories.ts');
  const needsProfile = await server.ssrLoadModule('/src/data/needsProfile.ts');
  const exportImport = await server.ssrLoadModule('/src/data/exportImport.ts');
  const habitModal = await server.ssrLoadModule('/src/components/habits/HabitModal.tsx');
  const goalModal = await server.ssrLoadModule('/src/components/goals/GoalModal.tsx');
  const debugPanel = await server.ssrLoadModule('/src/components/debug/EngineDebugPanel.tsx');
  const dbModule = await server.ssrLoadModule('/src/data/db.ts');
  const integrity = await server.ssrLoadModule('/src/data/integrity.ts');
  const completions = await server.ssrLoadModule('/src/data/completions.ts');
  const quickLog = await server.ssrLoadModule('/src/components/quicklog/QuickLogModal.tsx');
  const reminders = await server.ssrLoadModule('/src/data/reminders.ts');
  const calendar = await server.ssrLoadModule('/src/data/calendar.ts');
  const ics = await server.ssrLoadModule('/src/data/ics.ts');

  assert.equal(scoring.getUserEnergyBand(1), 'low');
  assert.equal(scoring.getUserEnergyBand(3), 'neutral');
  assert.equal(scoring.getUserEnergyBand(5), 'high');
  assert.equal(scoring.getUserEnergyBand(null), null);
  assert.equal(engine.normalizeEnergyLevel(1), 'LOW');
  assert.equal(engine.normalizeEnergyLevel(3), 'MEDIUM');
  assert.equal(engine.normalizeEnergyLevel(5), 'HIGH');
  assert.equal(categories.normalizeCategory('  WoRK  '), 'work');
  assert.equal(categories.normalizeCategory('Life_Admin'), 'life admin');
  assert.deepEqual(
    categories.TASK_CATEGORY_OPTIONS.map(category => categories.getTaskCategoryGroup(category)),
    ['school_work', 'school_work', 'health_energy', 'life_admin', 'life_admin', 'creative_projects', 'social', 'life_admin']
  );
  assert.equal(categories.getTaskCategoryGroup('Movement'), 'health_energy');
  assert.equal(categories.getTaskCategoryGroup('Unmapped custom domain'), 'unknown');
  assert.equal(categories.getTaskCategoryNeed('Social'), null);
  assert.equal(new Set(categories.TASK_CATEGORY_OPTIONS).size, categories.TASK_CATEGORY_OPTIONS.length);
  assert.equal(new Set(categories.HABIT_CATEGORY_OPTIONS).size, categories.HABIT_CATEGORY_OPTIONS.length);
  assert.equal(new Set(categories.GOAL_CATEGORY_OPTIONS).size, categories.GOAL_CATEGORY_OPTIONS.length);
  assert.equal(categories.TASK_CATEGORY_OPTIONS.includes(categories.CUSTOM_CATEGORY_OPTION), false);
  assert.equal(completions.isValidHabitCompletionValue('boolean', undefined), true);
  assert.equal(completions.isValidHabitCompletionValue('quantity', 1.5), true);
  assert.equal(completions.isValidHabitCompletionValue('time', 1.5), false);
  assert.equal(completions.isValidHabitCompletionValue('count', 0), false);
  assert.equal(quickLog.isValidDurationMinutes(1), true);
  assert.equal(quickLog.isValidDurationMinutes(0), false);
  assert.equal(quickLog.isValidDurationMinutes(1.5), false);

  const afterMidnightDefault = reminders.getDefaultManualReminderDateTime(new Date(2026, 6, 12, 23, 30));
  assert.deepEqual(afterMidnightDefault, { date: '2026-07-13', time: '00:30' });
  assert.equal(reminders.parseManualReminderDateTime('2026-02-30', '10:00'), null);
  assert.ok(reminders.parseManualReminderDateTime('2026-07-13', '10:00') instanceof Date);
  assert.equal(reminders.hasReminderGeneratingUserContext(0, 0, 0, 0), false);
  assert.equal(reminders.hasReminderGeneratingUserContext(0, 0, 0, 1), true);

  const multiDayBlock = {
    startAt: '2026-07-12T00:00:00',
    endAt: '2026-07-13T00:00:00',
  };
  assert.equal(calendar.calendarBlockOverlapsDate(multiDayBlock, '2026-07-12'), true);
  assert.equal(calendar.calendarBlockOverlapsDate(multiDayBlock, '2026-07-13'), false);
  assert.equal(calendar.isAllDayCalendarBlock(multiDayBlock), true);
  assert.equal(calendar.validateManualCalendarBlockInput({ title: 'Block', date: '2026-02-30' }), 'Calendar block date is invalid.');

  const allDayIcs = ics.parseIcsVevents([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:all-day-qa',
    'DTSTART;VALUE=DATE:20260712',
    'DTEND;VALUE=DATE:20260713',
    'SUMMARY:All day QA',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(allDayIcs.events.length, 1);
  assert.equal(calendar.isAllDayCalendarBlock(allDayIcs.events[0]), true);
  const invalidIcs = ics.parseIcsVevents([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART:20260230T090000',
    'SUMMARY:Invalid date',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(invalidIcs.events.length, 0);
  const wranglerConfig = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(wranglerConfig.assets, {
    directory: './dist',
    not_found_handling: 'single-page-application',
  });

  const legacyHabitMarkup = renderToStaticMarkup(React.createElement(habitModal.default, {
    habit: {
      id: 'legacy-habit',
      name: 'Legacy habit',
      category: 'Legacy Wellness',
      frequency: 'daily',
      completionType: 'boolean',
      completionHistory: [],
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:00:00.000Z',
    },
    onClose: () => undefined,
  }));
  assert.match(legacyHabitMarkup, /value="__custom__" selected="">OTHER \/ CUSTOM/);
  assert.match(legacyHabitMarkup, /Legacy Wellness/);

  const legacyGoalMarkup = renderToStaticMarkup(React.createElement(goalModal.default, {
    goal: {
      id: 'legacy-goal',
      title: 'Legacy goal',
      category: 'Legacy Project Type',
      horizon: 'month',
      linkedTaskIds: [],
      linkedHabitIds: [],
      status: 'active',
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:00:00.000Z',
    },
    onClose: () => undefined,
  }));
  assert.match(legacyGoalMarkup, /value="__custom__" selected="">OTHER \/ CUSTOM/);
  assert.match(legacyGoalMarkup, /Legacy Project Type/);

  const blankContext = makeContext({ hasUserContext: false });
  const blankCandidates = engine.getCandidateActions(blankContext);
  assert.equal(blankCandidates.length, 1);
  assert.equal(blankCandidates[0].ruleName, 'no_context_available');
  assert.equal(blankCandidates.some(candidate => candidate.ruleName === 'hydration'), false);
  assert.equal(blankCandidates.some(candidate => candidate.actionType === 'review_day'), false);

  const lowTask = makeTask({ id: 'low-task', energyRequired: 'low', estimatedMinutes: 15 });
  const highTask = makeTask({ id: 'high-task', energyRequired: 'high', estimatedMinutes: 90 });
  const lowEnergyContext = makeContext({
    pendingTasks: [lowTask, highTask],
    totalTaskCount: 2,
    lastEnergyValue: 1,
    userEnergyBand: 'low',
    latestEnergyLevel: 'LOW',
    latestMoodState: 'LOW',
    currentFocusCapacity: 'RECOVERY',
  });
  const lowTaskScore = scoring.scoreCandidate(taskCandidate(lowTask), lowEnergyContext).scoreBreakdown;
  const highTaskAtLowEnergyScore = scoring.scoreCandidate(taskCandidate(highTask), lowEnergyContext).scoreBreakdown;
  assert.ok(lowTaskScore.taskEnergyFitScore > highTaskAtLowEnergyScore.taskEnergyFitScore);
  assert.ok(lowTaskScore.finalScore > highTaskAtLowEnergyScore.finalScore);

  const highEnergyContext = makeContext({
    pendingTasks: [lowTask, highTask],
    totalTaskCount: 2,
    lastEnergyValue: 5,
    userEnergyBand: 'high',
    latestEnergyLevel: 'HIGH',
    latestMoodState: 'CLEAR',
    currentFocusCapacity: 'DEEP',
    plannedTaskIds: [highTask.id],
  });
  const highTaskAtHighEnergyScore = scoring.scoreCandidate(taskCandidate(highTask), highEnergyContext).scoreBreakdown;
  const lowTaskAtHighEnergyScore = scoring.scoreCandidate(taskCandidate(lowTask), highEnergyContext).scoreBreakdown;
  assert.ok(highTaskAtHighEnergyScore.taskEnergyFitScore > lowTaskAtHighEnergyScore.taskEnergyFitScore);
  assert.ok(highTaskAtHighEnergyScore.finalScore > lowTaskAtHighEnergyScore.finalScore);

  const neutralContext = makeContext({
    pendingTasks: [lowTask],
    totalTaskCount: 1,
    lastEnergyValue: 3,
    userEnergyBand: 'neutral',
    latestEnergyLevel: 'MEDIUM',
  });
  const neutralScore = scoring.scoreCandidate(taskCandidate(lowTask), neutralContext).scoreBreakdown;
  assert.equal(neutralScore.userEnergyFitScore, 0);

  const overloadedContext = makeContext({
    pendingTasks: [lowTask, highTask],
    totalTaskCount: 2,
    lastEnergyValue: 2,
    userEnergyBand: 'low',
    latestEnergyLevel: 'LOW',
    latestMoodState: 'OVERLOADED',
    currentFocusCapacity: 'RECOVERY',
  });
  const shortOverloadedScore = scoring.scoreCandidate(taskCandidate(lowTask), overloadedContext).scoreBreakdown;
  const longOverloadedScore = scoring.scoreCandidate(taskCandidate(highTask), overloadedContext).scoreBreakdown;
  assert.ok(shortOverloadedScore.finalScore > longOverloadedScore.finalScore);

  const criticalTask = makeTask({
    id: 'critical-task',
    priority: 'critical',
    dueDate: '2026-07-11',
    energyRequired: 'high',
    estimatedMinutes: 120,
  });
  const criticalContext = makeContext({
    pendingTasks: [criticalTask],
    criticalOverdueTasks: [criticalTask],
    highPriorityTasks: [criticalTask],
    totalTaskCount: 1,
    lastEnergyValue: 1,
    userEnergyBand: 'low',
    latestEnergyLevel: 'LOW',
    latestMoodState: 'OVERLOADED',
  });
  assert.equal(ranked(engine, scoring, criticalContext)[0].ruleName, 'critical_overdue_task');

  const activeBlock = {
    id: 'active-block',
    source: 'manual',
    title: 'Current commitment',
    startAt: '2026-07-12T09:30:00',
    endAt: '2026-07-12T10:30:00',
    convertedTaskIds: [],
    createdAt: '2026-07-12T08:00:00.000Z',
    updatedAt: '2026-07-12T08:00:00.000Z',
  };
  const blockContext = makeContext({
    pendingTasks: [criticalTask],
    criticalOverdueTasks: [criticalTask],
    highPriorityTasks: [criticalTask],
    totalTaskCount: 1,
    activeCalendarBlock: activeBlock,
    todaysCalendarBlocks: [activeBlock],
    totalCalendarBlockCount: 1,
  });
  assert.equal(ranked(engine, scoring, blockContext)[0].ruleName, 'active_calendar_block');

  const dueSoonTask = makeTask({
    id: 'due-soon',
    priority: 'medium',
    dueDate: '2026-07-12',
    dueTime: '11:00',
  });
  const dueSoonContext = makeContext({
    pendingTasks: [dueSoonTask],
    tasksWithDeadlineToday: [dueSoonTask],
    totalTaskCount: 1,
  });
  assert.equal(ranked(engine, scoring, dueSoonContext)[0].ruleName, 'closest_deadline_task');

  const workTask = makeTask({ id: 'work', category: 'Work' });
  const healthTask = makeTask({ id: 'health', category: 'Health' });
  const needsContext = makeContext({
    pendingTasks: [workTask, healthTask],
    totalTaskCount: 2,
    needsProfile: { selectedNeeds: ['school_work'], priorityMode: 'deadline' },
  });
  const workNeedsScore = scoring.scoreCandidate(taskCandidate(workTask), needsContext).scoreBreakdown.needsScore;
  const healthNeedsScore = scoring.scoreCandidate(taskCandidate(healthTask), needsContext).scoreBreakdown.needsScore;
  assert.ok(workNeedsScore > healthNeedsScore);
  const normalizedWorkTask = makeTask({ id: 'normalized-work', category: '  wOrK  ' });
  const unknownCategoryTask = makeTask({ id: 'unknown-category', category: 'Unmapped custom domain' });
  const categoryContext = makeContext({
    pendingTasks: [workTask, healthTask, normalizedWorkTask, unknownCategoryTask],
    totalTaskCount: 4,
    needsProfile: { selectedNeeds: ['school_work'], priorityMode: 'deadline' },
  });
  const normalizedWorkNeedsScore = scoring.scoreCandidate(taskCandidate(normalizedWorkTask), categoryContext).scoreBreakdown.needsScore;
  const unknownCategoryNeedsScore = scoring.scoreCandidate(taskCandidate(unknownCategoryTask), categoryContext).scoreBreakdown.needsScore;
  assert.equal(normalizedWorkNeedsScore, workNeedsScore);
  assert.equal(unknownCategoryNeedsScore, healthNeedsScore);

  const adminHighTask = makeTask({ id: 'admin-high', category: 'Admin', energyRequired: 'high', estimatedMinutes: 90 });
  const customHighTask = makeTask({ id: 'custom-high', category: 'Unmapped custom domain', energyRequired: 'high', estimatedMinutes: 90 });
  const categoryEnergyContext = makeContext({
    pendingTasks: [adminHighTask, customHighTask],
    totalTaskCount: 2,
    lastEnergyValue: 1,
    userEnergyBand: 'low',
    latestEnergyLevel: 'LOW',
  });
  const adminHighEnergyFit = scoring.scoreCandidate(taskCandidate(adminHighTask), categoryEnergyContext).scoreBreakdown.taskEnergyFitScore;
  const customHighEnergyFit = scoring.scoreCandidate(taskCandidate(customHighTask), categoryEnergyContext).scoreBreakdown.taskEnergyFitScore;
  assert.equal(adminHighTask.energyRequired, 'high');
  assert.equal(adminHighEnergyFit, customHighEnergyFit);

  const setupContext = makeContext({
    meaningfulActivityCountToday: 1,
    totalTaskCount: 0,
    totalHabitCount: 0,
    totalCalendarBlockCount: 0,
    needsProfile: { selectedNeeds: ['school_work'] },
  });
  const setupMicroActions = engine.getCandidateActions(setupContext)
    .filter(candidate => candidate.actionType === 'micro_action');
  assert.ok(setupMicroActions.some(candidate => candidate.microActionId === 'setup_add_task_today'));
  assert.ok(setupMicroActions.every(candidate => candidate.targetId === undefined));

  const establishedContext = makeContext({
    pendingTasks: [workTask],
    totalTaskCount: 1,
    totalHabitCount: 1,
    totalCalendarBlockCount: 1,
    minutesSinceLastTaskCreated: 0,
    needsProfile: { selectedNeeds: ['school_work'] },
  });
  const establishedMicroActions = engine.getCandidateActions(establishedContext)
    .filter(candidate => candidate.actionType === 'micro_action');
  assert.equal(establishedMicroActions.some(candidate => candidate.microActionId === 'setup_add_task_today'), false);

  assert.ok(microActions.MICRO_ACTIONS.length >= 50);
  assert.equal(new Set(microActions.MICRO_ACTIONS.map(action => action.id)).size, microActions.MICRO_ACTIONS.length);
  assert.ok(microActions.MICRO_ACTIONS.every(action => action.cooldownHours > 0));
  const coverage = microActions.getMicroActionNeedsCoverage();
  assert.ok(Object.values(coverage).every(count => count > 0));

  assert.equal(needsProfile.isValidUserEnergyLevel(1), true);
  assert.equal(needsProfile.isValidUserEnergyLevel(5), true);
  assert.equal(needsProfile.isValidUserEnergyLevel(0), false);
  assert.equal(needsProfile.isValidUserEnergyLevel(3.5), false);
  assert.equal(needsProfile.isValidUserEnergyLevel(6), false);
  assert.equal(needsProfile.isWithinNeedsQuietHours(new Date(2026, 6, 12, 23, 30), '23:00', '08:00'), true);
  assert.equal(needsProfile.isWithinNeedsQuietHours(new Date(2026, 6, 12, 7, 30), '23:00', '08:00'), true);
  assert.equal(needsProfile.isWithinNeedsQuietHours(new Date(2026, 6, 12, 12, 0), '23:00', '08:00'), false);
  assert.equal(needsProfile.getStateCheckIntervalHours({ checkInIntervalHours: 6 }, 1), 6);
  assert.equal(needsProfile.getStateCheckIntervalHours({ checkInIntervalHours: 6 }, 2), 12);

  const backup = {
    app: 'NOW_WHAT?',
    exportVersion: 3,
    schemaVersion: 3,
    exportedAt: '2026-07-12T10:00:00.000Z',
    profile: { id: 'qa-profile', displayName: 'QA', createdAt: '2026-07-12T08:00:00.000Z' },
    stores: {
      tasks: [],
      habits: [],
      goals: [],
      calendarBlocks: [],
      activityLogs: [
        { id: 'energy-log', type: 'energy', label: 'Energy - 3/5', quantity: 3, createdAt: '2026-07-12T09:00:00.000Z' },
        { id: 'state-log', type: 'state_check', label: 'State check', state: 'neutral', energyLevel: 3, createdAt: '2026-07-12T09:30:00.000Z' },
      ],
      dailyPlans: [],
      suggestions: [{ id: 'suggestion', status: 'dismissed', actionType: 'micro_action', createdAt: '2026-07-12T09:45:00.000Z' }],
      dailyReviews: [],
      weeklyReviews: [],
      settings: [],
      reminders: [],
      needsProfiles: [{ ...makeContext().needsProfile, onboardingCompletedAt: '2026-07-12T08:30:00.000Z' }],
    },
  };
  const backupValidation = exportImport.validateBackup(backup);
  assert.equal(backupValidation.valid, true);
  assert.equal(backupValidation.summary.needsProfiles, 1);
  assert.equal(backupValidation.summary.activityLogs, 2);
  assert.equal(backupValidation.summary.suggestions, 1);
  assert.equal(exportImport.backupHasUserData(backup.stores), true);
  assert.equal(exportImport.backupHasUserData({
    ...backup.stores,
    activityLogs: [],
    suggestions: [],
    needsProfiles: [],
  }), false);
  const legacyBackup = structuredClone(backup);
  legacyBackup.schemaVersion = 2;
  delete legacyBackup.stores.needsProfiles;
  assert.equal(exportImport.validateBackup(legacyBackup).valid, true);
  const invalidBackup = structuredClone(backup);
  invalidBackup.stores.tasks.push({ id: 'broken-task', title: 'Broken' });
  assert.equal(exportImport.validateBackup(invalidBackup).valid, false);
  const missedTaskBackup = structuredClone(backup);
  missedTaskBackup.stores.tasks.push(makeTask({ id: 'missed-task', status: 'missed' }));
  assert.equal(exportImport.validateBackup(missedTaskBackup).valid, true);
  const weeklyReviewBackup = structuredClone(backup);
  weeklyReviewBackup.stores.weeklyReviews.push({
    id: 'weekly-review',
    weekStart: '2026-07-06',
    weekEnd: '2026-07-12',
    completedTaskCount: 0,
    missedTaskCount: 0,
    completedHabitCount: 0,
    focusMinutes: 0,
    distractionMinutes: 0,
    restMinutes: 0,
    movementMinutes: 0,
    waterMl: 0,
    mealsLogged: 0,
    mostConsistentHabits: [],
    mostMissedHabits: [],
    repeatedMissedTaskTitles: [],
    goalProgressNotes: [],
    generatedSummary: 'No activity.',
    createdAt: '2026-07-12T20:00:00.000Z',
    updatedAt: '2026-07-12T20:00:00.000Z',
  });
  assert.equal(exportImport.validateBackup(weeklyReviewBackup).valid, true);

  const debugCandidate = scoring.scoreCandidate(taskCandidate(lowTask), lowEnergyContext);
  const debugSuggestion = {
    id: 'debug-primary',
    createdAt: '2026-07-12T10:00:00.000Z',
    actionType: 'start_task',
    targetId: lowTask.id,
    command: 'START TASK',
    targetLabel: lowTask.title,
    reason: debugCandidate.reason,
    status: 'shown',
    contextSnapshot: { selectedCandidateIdentity: debugCandidate.identity },
  };
  const debugContext = {
    ...lowEnergyContext,
    selectedCandidateIdentity: debugCandidate.identity,
    activeCooldownCount: 1,
    excludedCandidateIdentities: ['micro:qa (cooling down)'],
  };
  const debugMarkup = renderToStaticMarkup(React.createElement(debugPanel.default, {
    context: debugContext,
    candidates: [debugCandidate],
    suggestion: debugSuggestion,
    deck: {
      primary: debugSuggestion,
      alternatives: [],
      state: 'ready',
      pendingCount: 2,
      supportText: 'Critical task pending: QA.',
    },
    onClose: () => undefined,
  }));
  assert.match(debugMarkup, /ENGINE DEBUG \/ V1\.2/);
  assert.match(debugMarkup, /latestUserEnergyLevel/);
  assert.match(debugMarkup, /scoringEnergyBand/);
  assert.match(debugMarkup, /TASK ENERGY MATCHING/);
  assert.match(debugMarkup, /TASK CATEGORY CONTEXT/);
  assert.match(debugMarkup, /normalized=work/);
  assert.match(debugMarkup, /group=school_work/);
  assert.match(debugMarkup, /effect=Needs Profile match/);
  assert.match(debugMarkup, /CANDIDATE SCORING/);
  assert.match(debugMarkup, /COOLDOWN \/ OVERRIDES/);
  assert.doesNotMatch(debugMarkup, />SAVE</);

  const validProfile = makeContext().needsProfile;
  dbModule.setActiveDb(makeIntegrityDb({
    tasks: [lowTask],
    activityLogs: backup.stores.activityLogs,
    needsProfiles: [validProfile],
  }));
  const validIntegrityReport = await integrity.runIntegrityChecks();
  assert.equal(validIntegrityReport.issues.length, 0);

  dbModule.setActiveDb(makeIntegrityDb({
    tasks: [{ ...lowTask, energyRequired: 'extreme' }],
    activityLogs: [{ id: 'invalid-energy', type: 'energy', label: 'Invalid energy', quantity: 9, createdAt: '2026-07-12T09:00:00.000Z' }],
    needsProfiles: [validProfile],
  }));
  const invalidIntegrityReport = await integrity.runIntegrityChecks();
  assert.ok(invalidIntegrityReport.issues.some(issue => issue.message.includes('invalid energyRequired')));
  assert.ok(invalidIntegrityReport.issues.some(issue => issue.message.includes('value from 1 to 5')));

  dbModule.setActiveDb(makeIntegrityDb({
    calendarBlocks: [{ id: 'bad-block', title: 'Bad block', startAt: 'not-a-date', endAt: 'also-bad', convertedTaskIds: [] }],
    activityLogs: [{ id: 'bad-focus', type: 'focus', label: 'Bad focus', durationMinutes: 0, createdAt: 'not-a-date' }],
    reminders: [{ id: 'bad-reminder', type: 'manual', title: 'Bad reminder', status: 'scheduled', enabled: true, scheduledAt: 'not-a-date' }],
    needsProfiles: [validProfile],
  }));
  const malformedIntegrityReport = await integrity.runIntegrityChecks();
  assert.ok(malformedIntegrityReport.issues.some(issue => issue.message.includes('invalid start or end time')));
  assert.ok(malformedIntegrityReport.issues.some(issue => issue.message.includes('positive whole-minute duration')));
  assert.ok(malformedIntegrityReport.issues.some(issue => issue.message.includes('invalid scheduledAt')));

  console.log('v1.2 engine QA: 103 assertions passed');
} finally {
  await server.close();
}
