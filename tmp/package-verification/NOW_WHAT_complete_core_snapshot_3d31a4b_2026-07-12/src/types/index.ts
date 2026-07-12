export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'complete' | 'skipped' | 'missed';
export type TaskEnergyRequirement = 'low' | 'medium' | 'high';
export type EnergyLevel = TaskEnergyRequirement;
export type TaskCategory = 'School' | 'Work' | 'Health' | 'Admin' | 'Personal' | 'Creative' | 'Social' | 'Maintenance' | string;

export type NeedType =
  | 'school_work'
  | 'habit_consistency'
  | 'health_energy'
  | 'life_admin'
  | 'creative_projects';

export type PriorityMode =
  | 'deadline'
  | 'critical'
  | 'easy_start'
  | 'daily_focus'
  | 'energy_match';

export type LowEnergyPreference =
  | 'short_tasks'
  | 'admin'
  | 'recovery'
  | 'health'
  | 'critical_only';

export type StateType =
  | 'clear'
  | 'neutral'
  | 'low'
  | 'stressed'
  | 'restless'
  | 'overloaded';

export type FocusCapacity = 'deep' | 'normal' | 'light' | 'recovery';
export type UserEnergyLevel = 1 | 2 | 3 | 4 | 5;
export type UserEnergyLevelValue = UserEnergyLevel;
export type UserEnergyBand = 'low' | 'neutral' | 'high';

export interface NeedsProfile {
  id: 'default';
  selectedNeeds: NeedType[];
  priorityMode: PriorityMode;
  lowEnergyPreference: LowEnergyPreference;
  checkInEnabled: boolean;
  checkInIntervalHours: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  onboardingCompletedAt?: string;
  onboardingDismissedAt?: string;
  lastStateCheckAt?: string;
  nextStateCheckAt?: string;
  stateCheckDismissCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepeatRule {
  type: 'none' | 'daily' | 'weekly' | 'custom';
  daysOfWeek?: number[];
  interval?: number;
}

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  priority: Priority;
  status: TaskStatus;
  estimatedMinutes?: number;
  dueDate?: string;
  dueTime?: string;
  repeatRule: RepeatRule;
  energyRequired: TaskEnergyRequirement;
  goalId?: string;
  notes?: string;
  carryOverHistory: string[];
  missedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface HabitCompletion {
  date: string;
  value?: number;
  completedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'custom';
  completionType: 'boolean' | 'quantity' | 'time' | 'count';
  targetValue?: number;
  targetUnit?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  minimumVersion?: string;
  goalId?: string;
  notes?: string;
  completionHistory: HabitCompletion[];
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  horizon: 'week' | 'month' | 'semester' | 'year' | 'ongoing';
  linkedTaskIds: string[];
  linkedHabitIds: string[];
  status: 'active' | 'paused' | 'complete';
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarBlock {
  id: string;
  source: 'manual' | 'ics' | 'google_ics' | 'google_api' | 'apple_ics' | 'google_stub' | 'apple_stub';
  externalId?: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  calendarName?: string;
  importedAt?: string;
  convertedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type LogType =
  | 'task_completed'
  | 'habit_completed'
  | 'water'
  | 'meal'
  | 'exercise'
  | 'focus'
  | 'mood'
  | 'energy'
  | 'state_check'
  | 'rest'
  | 'distraction'
  | 'calendar'
  | 'note';

export interface ActivityLog {
  id: string;
  type: LogType;
  label: string;
  startAt?: string;
  endAt?: string;
  durationMinutes?: number;
  quantity?: number;
  unit?: string;
  state?: StateType;
  energyLevel?: UserEnergyLevel;
  relatedTaskId?: string;
  relatedHabitId?: string;
  relatedGoalId?: string;
  notes?: string;
  createdAt: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  primaryFocus?: string;
  plannedTaskIds: string[];
  plannedHabitIds: string[];
  calendarBlockIds: string[];
  lifestyleMinimums: {
    waterMl?: number;
    meals?: number;
    movementMinutes?: number;
    focusMinutes?: number;
    restMinutes?: number;
  };
  carryOverTaskIds: string[];
  reviewStatus: 'not_started' | 'in_progress' | 'complete';
  createdAt: string;
  updatedAt: string;
}

export type SuggestionActionType =
  | 'start_task'
  | 'complete_habit'
  | 'begin_focus'
  | 'log_water'
  | 'log_meal'
  | 'move'
  | 'rest'
  | 'review_day'
  | 'plan_tomorrow'
  | 'clear_state'
  | 'acknowledge_block'
  | 'micro_action';

export type MicroActionCategory =
  | 'setup'
  | 'planning'
  | 'low_energy'
  | 'recovery'
  | 'movement'
  | 'admin'
  | 'focus'
  | 'creative'
  | 'review'
  | 'maintenance';

export type MicroActionIntent =
  | 'add_task'
  | 'add_habit'
  | 'add_calendar_block'
  | 'open_tasks'
  | 'open_habits'
  | 'open_calendar'
  | 'open_review'
  | 'open_quick_log'
  | 'open_needs_profile'
  | 'log_state'
  | 'log_water'
  | 'log_movement'
  | 'log_rest'
  | 'plan_day'
  | 'review_tasks';

export interface MicroActionTemplate {
  id: string;
  title: string;
  body: string;
  category: MicroActionCategory;
  actionType: 'micro_action';
  actionIntent: MicroActionIntent;
  needsTags: NeedType[];
  stateTags: StateType[];
  capacityTags: FocusCapacity[];
  energyBandTags: UserEnergyBand[];
  eligibleWhen: string[];
  cooldownHours: number;
}

export interface CandidateScoreBreakdown {
  candidateIdentity: string;
  ruleName: string;
  actionType: string;
  targetLabel: string;
  baseScore: number;
  urgencyScore: number;
  needsScore: number;
  userEnergyFitScore: number;
  taskEnergyFitScore?: number;
  stateFitScore: number;
  timeFitScore: number;
  cooldownPenalty: number;
  varietyPenalty: number;
  finalScore: number;
  explanationParts: string[];
  selected?: boolean;
  excludedReason?: string;
}

export interface RecommendationDeck {
  primary?: Suggestion;
  alternatives: Suggestion[];
  state: 'ready' | 'no_context' | 'cooldown' | 'empty';
  supportText?: string;
  pendingCount?: number;
  debug?: CandidateScoreBreakdown[];
}

export interface Suggestion {
  id: string;
  createdAt: string;
  actionType: SuggestionActionType;
  targetId?: string;
  command: string;
  targetLabel: string;
  reason: string;
  status: 'shown' | 'accepted' | 'dismissed' | 'completed' | 'ignored';
  contextSnapshot: Record<string, unknown>;
}

/**
 * DailyReview — all new fields (added in Step 7) are optional for backward
 * compatibility with pre-Step-7 records that only had id/date/reflection/createdAt/updatedAt.
 */
export interface DailyReview {
  id: string;
  date: string;
  reflection?: string;           // legacy field name from pre-Step-7
  completedTaskIds?: string[];
  missedTaskIds?: string[];
  completedHabitIds?: string[];
  focusMinutes?: number;
  distractionMinutes?: number;
  restMinutes?: number;
  waterMl?: number;
  mealsLogged?: number;
  movementMinutes?: number;
  sleepHours?: number;
  calendarBlockIds?: string[];
  carryOverTaskIds?: string[];
  generatedSummary?: string;
  reflectionNote?: string;
  status?: 'draft' | 'complete';
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;
  weekEnd: string;
  completedTaskCount: number;
  missedTaskCount: number;
  completedHabitCount: number;
  focusMinutes: number;
  distractionMinutes: number;
  restMinutes: number;
  movementMinutes: number;
  waterMl: number;
  mealsLogged: number;
  mostConsistentHabits: string[];
  mostMissedHabits: string[];
  repeatedMissedTaskTitles: string[];
  bestFocusWindow?: string;
  struggleWindow?: string;
  goalProgressNotes: string[];
  generatedSummary: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Settings — existing fields kept; new fields are optional for back-compat.
 */
export interface Settings {
  id: string;
  theme: 'dark';
  // Data controls metadata
  appVersion?: string;
  schemaVersion?: number;
  localProfileId?: string;
  lastExportAt?: string;
  lastImportAt?: string;
  seedEnabled?: boolean;
  // Tutorial/onboarding status
  tutorialPromptSeenAt?: string;
  tutorialCompletedAt?: string;
  tutorialDismissedAt?: string;
  // Reminder settings
  remindersEnabled?: boolean;
  browserNotificationsEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  hydrationRemindersEnabled?: boolean;
  movementRemindersEnabled?: boolean;
  reviewReminderEnabled?: boolean;
  calendarRemindersEnabled?: boolean;
  taskDueRemindersEnabled?: boolean;
  habitWindowRemindersEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  type:
    | 'task_due'
    | 'habit_window'
    | 'calendar_block'
    | 'planned_focus'
    | 'daily_review'
    | 'previous_review'
    | 'hydration'
    | 'movement'
    | 'manual'
    | 'custom';
  title: string;
  message: string;
  targetType?: 'task' | 'habit' | 'calendarBlock' | 'dailyPlan' | 'review' | 'quickLog';
  targetId?: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'dismissed' | 'completed' | 'cancelled';
  source: 'system' | 'user';
  repeat?: 'none' | 'daily' | 'weekly';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}
