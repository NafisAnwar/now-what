import type { NeedType } from '../types';

export const STANDARD_CATEGORY_OPTIONS = [
  'School',
  'Work',
  'Health',
  'Admin',
  'Personal',
  'Creative',
  'Social',
  'Maintenance',
] as const;

export const TASK_CATEGORY_OPTIONS = STANDARD_CATEGORY_OPTIONS;
export const HABIT_CATEGORY_OPTIONS = STANDARD_CATEGORY_OPTIONS;
export const GOAL_CATEGORY_OPTIONS = STANDARD_CATEGORY_OPTIONS;
export const CUSTOM_CATEGORY_OPTION = '__custom__';

export type TaskCategoryNeed = Exclude<NeedType, 'habit_consistency'>;
export type TaskCategoryGroup = TaskCategoryNeed | 'social' | 'unknown';

const TASK_CATEGORY_ALIASES: Record<Exclude<TaskCategoryGroup, 'unknown'>, readonly string[]> = {
  school_work: ['school', 'work', 'school work'],
  health_energy: ['health', 'movement', 'exercise', 'physical', 'health energy'],
  life_admin: ['admin', 'maintenance', 'personal', 'life admin'],
  creative_projects: ['creative', 'creative projects'],
  social: ['social'],
};

export function normalizeCategory(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[_&/\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function isCategoryOption(value: string, options: readonly string[]): boolean {
  return options.includes(value);
}

export function getTaskCategoryGroup(value: unknown): TaskCategoryGroup {
  const normalized = normalizeCategory(value);
  if (!normalized) return 'unknown';

  for (const [group, aliases] of Object.entries(TASK_CATEGORY_ALIASES)) {
    if (aliases.includes(normalized)) return group as Exclude<TaskCategoryGroup, 'unknown'>;
  }

  return 'unknown';
}

export function getTaskCategoryNeed(value: unknown): TaskCategoryNeed | null {
  const group = getTaskCategoryGroup(value);
  return group === 'social' || group === 'unknown' ? null : group;
}
