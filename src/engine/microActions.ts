import type {
  FocusCapacity,
  MicroActionCategory,
  MicroActionIntent,
  MicroActionTemplate,
  NeedType,
  StateType,
  UserEnergyBand,
} from '../types';

const ALL_NEEDS: NeedType[] = [
  'school_work', 'habit_consistency', 'health_energy', 'life_admin', 'creative_projects',
];
const EXECUTION_NEEDS: NeedType[] = ['school_work', 'life_admin', 'creative_projects'];
const ROUTINE_NEEDS: NeedType[] = ['habit_consistency', 'health_energy'];
const HEALTH_ADMIN_NEEDS: NeedType[] = ['health_energy', 'life_admin', 'habit_consistency'];
const ALL_STATES: StateType[] = ['clear', 'neutral', 'low', 'stressed', 'restless', 'overloaded'];
const WORK_STATES: StateType[] = ['clear', 'neutral', 'restless'];
const LIGHT_STATES: StateType[] = ['low', 'stressed', 'restless', 'overloaded'];
const ALL_CAPACITIES: FocusCapacity[] = ['deep', 'normal', 'light', 'recovery'];
const WORK_CAPACITIES: FocusCapacity[] = ['deep', 'normal', 'light'];
const LIGHT_CAPACITIES: FocusCapacity[] = ['normal', 'light', 'recovery'];
const ALL_ENERGY_BANDS: UserEnergyBand[] = ['low', 'neutral', 'high'];
const LOW_NEUTRAL_ENERGY: UserEnergyBand[] = ['low', 'neutral'];
const NEUTRAL_HIGH_ENERGY: UserEnergyBand[] = ['neutral', 'high'];

function micro(
  id: string,
  title: string,
  body: string,
  category: MicroActionCategory,
  actionIntent: MicroActionIntent,
  needsTags: NeedType[],
  stateTags: StateType[] = ALL_STATES,
  capacityTags: FocusCapacity[] = ALL_CAPACITIES,
  energyBandTags: UserEnergyBand[] = ALL_ENERGY_BANDS,
  eligibleWhen: string[] = ['always'],
  cooldownHours = 2
): MicroActionTemplate {
  return {
    id,
    title,
    body,
    category,
    actionType: 'micro_action',
    actionIntent,
    needsTags: [...needsTags],
    stateTags: [...stateTags],
    capacityTags: [...capacityTags],
    energyBandTags: [...energyBandTags],
    eligibleWhen,
    cooldownHours,
  };
}

export const MICRO_ACTIONS: readonly MicroActionTemplate[] = [
  micro('setup_add_task_today', 'ADD ONE TASK', 'Add one concrete task for today.', 'setup', 'add_task', EXECUTION_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_tasks'], 1),
  micro('setup_add_habit', 'ADD ONE HABIT', 'Add one repeated action to track.', 'setup', 'add_habit', ROUTINE_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_habits'], 2),
  micro('setup_add_calendar_block', 'ADD CALENDAR BLOCK', 'Add the next fixed commitment.', 'setup', 'add_calendar_block', ['school_work', 'life_admin', 'creative_projects'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_calendar_blocks'], 2),
  micro('setup_profile', 'CONFIGURE PROFILE', 'Set recommendation priorities and State Check preferences.', 'setup', 'open_needs_profile', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['needs_profile_incomplete'], 6),
  micro('setup_capture_note', 'CAPTURE ONE NOTE', 'Record one item before it is lost.', 'setup', 'open_quick_log', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 2),

  micro('planning_set_focus', 'SET PRIMARY FOCUS', 'Set one primary focus for today.', 'planning', 'plan_day', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 3),
  micro('planning_next_30', 'PLAN NEXT 30 MINUTES', 'Choose one bounded action for the next 30 minutes.', 'planning', 'plan_day', EXECUTION_NEEDS, LIGHT_STATES, LIGHT_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 2),
  micro('planning_review_pending', 'REVIEW PENDING TASKS', 'Scan pending tasks and identify the next concrete item.', 'planning', 'review_tasks', EXECUTION_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['pending_tasks'], 2),
  micro('planning_tomorrow_first', 'REVIEW TODAY\'S PLAN', 'Open the dashboard and adjust today\'s plan.', 'planning', 'plan_day', EXECUTION_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['activity_exists'], 6),
  micro('planning_upcoming_calendar', 'CHECK UPCOMING BLOCKS', 'Review the next calendar commitments.', 'planning', 'open_calendar', ['school_work', 'life_admin', 'creative_projects'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['calendar_available'], 3),
  micro('planning_carry_over', 'REVIEW UNFINISHED WORK', 'Choose one unfinished task to carry forward.', 'planning', 'review_tasks', EXECUTION_NEEDS, ['neutral', 'stressed', 'overloaded'], LIGHT_CAPACITIES, ALL_ENERGY_BANDS, ['pending_tasks'], 4),

  micro('low_start_smallest', 'START SMALLEST PLANNED TASK', 'Open the task list and start the smallest planned item.', 'low_energy', 'open_tasks', EXECUTION_NEEDS, LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['planned_tasks'], 2),
  micro('low_admin_item', 'OPEN LOW-EFFORT ADMIN', 'Review pending tasks for one low-effort admin item.', 'low_energy', 'review_tasks', ['school_work', 'life_admin'], LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 2),
  micro('low_break_next_step', 'DEFINE ONE NEXT STEP', 'Turn one large task into a concrete next step.', 'low_energy', 'open_tasks', EXECUTION_NEEDS, ['low', 'stressed', 'overloaded'], LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 2),
  micro('low_choose_short', 'CHOOSE A SHORT TASK', 'Review pending work and choose a task under 30 minutes.', 'low_energy', 'review_tasks', EXECUTION_NEEDS, LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 2),
  micro('low_review_list', 'SCAN TASK LIST', 'Review tasks without starting a long work block.', 'low_energy', 'open_tasks', ALL_NEEDS, LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 2),
  micro('low_add_admin', 'ADD LIFE-ADMIN TASK', 'Capture one concrete life-admin item.', 'low_energy', 'add_task', ['life_admin'], LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['no_recent_task'], 3),
  micro('low_maintenance', 'CHOOSE MAINTENANCE ITEM', 'Open tasks and select one small maintenance action.', 'low_energy', 'review_tasks', ['life_admin', 'health_energy'], LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 3),

  micro('recovery_short_rest', 'TAKE SHORT REST', 'Open Quick Log and record a short intentional rest.', 'recovery', 'log_rest', HEALTH_ADMIN_NEEDS, LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['no_urgent_work'], 3),
  micro('recovery_add_block', 'ADD RECOVERY BLOCK', 'Add a bounded recovery block to the calendar.', 'recovery', 'add_calendar_block', ['health_energy', 'life_admin'], LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['no_urgent_work'], 4),
  micro('recovery_log_state', 'LOG CURRENT STATE', 'Record current state and Energy Level.', 'recovery', 'log_state', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 2),
  micro('recovery_log_rest', 'LOG REST', 'Open Quick Log and record rest time.', 'recovery', 'log_rest', ['health_energy', 'habit_consistency'], LIGHT_STATES, LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['always'], 2),
  micro('recovery_choose_mode', 'REVIEW WORK OR RECOVERY', 'Review pending work before choosing work or recovery.', 'recovery', 'review_tasks', ['health_energy', 'school_work', 'life_admin'], ['low', 'stressed', 'overloaded'], LIGHT_CAPACITIES, LOW_NEUTRAL_ENERGY, ['pending_tasks'], 3),

  micro('movement_short_reset', 'SHORT MOVEMENT RESET', 'Open Quick Log and record a short movement reset.', 'movement', 'log_movement', ROUTINE_NEEDS, ['restless', 'low', 'stressed'], LIGHT_CAPACITIES, ALL_ENERGY_BANDS, ['no_urgent_work'], 2),
  micro('movement_log', 'LOG MOVEMENT', 'Record completed movement.', 'movement', 'log_movement', ROUTINE_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 2),
  micro('movement_add_block', 'ADD MOVEMENT BLOCK', 'Add a short movement block to the calendar.', 'movement', 'add_calendar_block', ['health_energy', 'habit_consistency', 'life_admin'], ['neutral', 'restless'], LIGHT_CAPACITIES, NEUTRAL_HIGH_ENERGY, ['no_urgent_work'], 4),
  micro('movement_active_reset', 'TAKE ACTIVE RESET', 'Use a brief active reset before the next work block.', 'movement', 'log_movement', ['health_energy', 'habit_consistency', 'school_work'], ['restless'], ['normal', 'light'], NEUTRAL_HIGH_ENERGY, ['no_urgent_work'], 2),

  micro('admin_clear_small', 'CLEAR SMALL ADMIN ITEM', 'Open tasks and clear one small admin item.', 'admin', 'open_tasks', ['life_admin', 'school_work'], ALL_STATES, LIGHT_CAPACITIES, ALL_ENERGY_BANDS, ['pending_tasks'], 2),
  micro('admin_review_reminders', 'REVIEW REMINDER-BOUND WORK', 'Review tasks that need a time or reminder.', 'admin', 'review_tasks', ['life_admin', 'school_work', 'habit_consistency'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['pending_tasks'], 3),
  micro('admin_calendar_to_task', 'REVIEW CALENDAR CONVERSION', 'Open calendar blocks and convert one actionable block if needed.', 'admin', 'open_calendar', ['life_admin', 'school_work'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['calendar_available'], 4),
  micro('admin_capture_inbox', 'CAPTURE ADMIN TASK', 'Add one concrete admin task.', 'admin', 'add_task', ['life_admin'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_recent_task'], 3),
  micro('admin_review_profile', 'REVIEW PROFILE SETTINGS', 'Check recommendation priorities and State Check timing.', 'maintenance', 'open_needs_profile', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 12),

  micro('focus_10', 'OPEN FOCUS LOG', 'Open Quick Log to record completed focus time.', 'focus', 'open_quick_log', ['school_work', 'creative_projects'], WORK_STATES, WORK_CAPACITIES, ALL_ENERGY_BANDS, ['no_urgent_block'], 2),
  micro('focus_25', 'LOG FOCUS TIME', 'Open Quick Log to record a completed focus block.', 'focus', 'open_quick_log', ['school_work', 'creative_projects'], WORK_STATES, WORK_CAPACITIES, NEUTRAL_HIGH_ENERGY, ['no_urgent_block'], 2),
  micro('focus_deep_priority', 'OPEN HIGH-VALUE WORK', 'Review high-priority work for a deeper focus block.', 'focus', 'review_tasks', ['school_work', 'creative_projects'], ['clear', 'neutral'], ['deep', 'normal'], ['high'], ['pending_tasks'], 2),
  micro('focus_deadline', 'OPEN CLOSEST DEADLINE', 'Review the closest-deadline task.', 'focus', 'review_tasks', ['school_work', 'life_admin'], ALL_STATES, WORK_CAPACITIES, ALL_ENERGY_BANDS, ['pending_tasks'], 2),
  micro('focus_resume_planned', 'RESUME PLANNED WORK', 'Open the planned task list.', 'focus', 'open_tasks', ['school_work', 'creative_projects', 'life_admin'], WORK_STATES, WORK_CAPACITIES, NEUTRAL_HIGH_ENERGY, ['planned_tasks'], 2),
  micro('focus_log_session', 'LOG FOCUS SESSION', 'Record a completed focus session.', 'focus', 'open_quick_log', ['school_work', 'creative_projects', 'habit_consistency'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['always'], 2),

  micro('creative_add_task', 'ADD CREATIVE TASK', 'Capture one concrete creative project task.', 'creative', 'add_task', ['creative_projects'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_recent_task'], 3),
  micro('creative_start_draft', 'OPEN CREATIVE DRAFT', 'Review creative tasks and start one draft.', 'creative', 'open_tasks', ['creative_projects'], ['clear', 'neutral', 'restless'], WORK_CAPACITIES, NEUTRAL_HIGH_ENERGY, ['pending_tasks'], 2),
  micro('creative_review_goal', 'REVIEW PROJECT GOAL', 'Review tasks linked to an active project goal.', 'creative', 'review_tasks', ['creative_projects', 'school_work'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['goals_available'], 4),
  micro('creative_link_goal', 'REVIEW WORK AND GOALS', 'Open Tasks and review work against active goals.', 'creative', 'open_tasks', ['creative_projects', 'school_work', 'life_admin'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['goals_available', 'pending_tasks'], 6),

  micro('review_today_activity', 'REVIEW TODAY ACTIVITY', 'Open Daily Review for today\'s recorded activity.', 'review', 'open_review', ALL_NEEDS, ['neutral', 'stressed', 'overloaded'], ALL_CAPACITIES, ALL_ENERGY_BANDS, ['review_available'], 4),
  micro('review_complete_daily', 'COMPLETE DAILY REVIEW', 'Open the available Daily Review.', 'review', 'open_review', ['school_work', 'habit_consistency', 'health_energy', 'life_admin'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['review_available'], 6),
  micro('review_weekly_patterns', 'REVIEW WEEKLY PATTERNS', 'Open Review and inspect weekly activity patterns.', 'review', 'open_review', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['activity_exists'], 12),
  micro('review_goal_progress', 'REVIEW GOAL-LINKED WORK', 'Review tasks connected to active goals.', 'review', 'review_tasks', ['school_work', 'creative_projects', 'life_admin'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['goals_available'], 6),
  micro('review_focus_balance', 'REVIEW FOCUS AND REST', 'Open Review and inspect focus, rest, and distraction logs.', 'review', 'open_review', ['health_energy', 'school_work', 'habit_consistency'], ['neutral', 'low', 'stressed', 'overloaded'], ALL_CAPACITIES, ALL_ENERGY_BANDS, ['activity_exists'], 8),

  micro('maintenance_next_commitment', 'CHECK NEXT COMMITMENT', 'Open the calendar and check the next fixed commitment.', 'maintenance', 'open_calendar', ['life_admin', 'school_work', 'creative_projects'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['calendar_available'], 3),
  micro('maintenance_habit_window', 'CHECK ACTIVE HABIT WINDOW', 'Open habits and review the active window.', 'maintenance', 'open_habits', ['habit_consistency', 'health_energy'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['active_habit_window'], 2),
  micro('maintenance_log_water', 'LOG WATER', 'Open Quick Log and record water.', 'maintenance', 'log_water', ['health_energy', 'habit_consistency'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['user_context'], 2),
  micro('maintenance_log_meal', 'LOG MEAL', 'Open Quick Log and record a meal.', 'maintenance', 'open_quick_log', ['health_energy', 'habit_consistency'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['user_context'], 3),
  micro('maintenance_log_energy', 'LOG ENERGY LEVEL', 'Open Quick Log and record current Energy Level.', 'maintenance', 'open_quick_log', ALL_NEEDS, ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['user_context'], 2),
  micro('maintenance_log_distraction', 'LOG DISTRACTION', 'Open Quick Log and record distraction time.', 'maintenance', 'open_quick_log', ['school_work', 'creative_projects', 'health_energy'], ['neutral', 'stressed', 'restless', 'overloaded'], ALL_CAPACITIES, ALL_ENERGY_BANDS, ['user_context'], 3),
  micro('maintenance_health_habit', 'ADD HEALTH HABIT', 'Add one health-maintenance habit.', 'maintenance', 'add_habit', ['health_energy', 'habit_consistency'], ALL_STATES, ALL_CAPACITIES, ALL_ENERGY_BANDS, ['no_habits'], 6),
];

export function getMicroActionById(id: string): MicroActionTemplate | undefined {
  return MICRO_ACTIONS.find(template => template.id === id);
}

export function getMicroActionNeedsCoverage(): Record<NeedType, number> {
  return ALL_NEEDS.reduce((coverage, need) => {
    coverage[need] = MICRO_ACTIONS.filter(template => template.needsTags.includes(need)).length;
    return coverage;
  }, {} as Record<NeedType, number>);
}
