import { db, type NowWhatDB } from './db';
import type {
  LowEnergyPreference,
  NeedType,
  NeedsProfile,
  PriorityMode,
  Settings,
  StateType,
} from '../types';

export const NEEDS_PROFILE_ID = 'default';
export const DEFAULT_CHECK_IN_INTERVAL_HOURS = 6;
export const DEFAULT_QUIET_HOURS_START = '23:00';
export const DEFAULT_QUIET_HOURS_END = '08:00';

export const VALID_NEED_TYPES: readonly NeedType[] = [
  'school_work',
  'habit_consistency',
  'health_energy',
  'life_admin',
  'creative_projects',
];

export const VALID_PRIORITY_MODES: readonly PriorityMode[] = [
  'deadline',
  'critical',
  'easy_start',
  'daily_focus',
  'energy_match',
];

export const VALID_LOW_ENERGY_PREFERENCES: readonly LowEnergyPreference[] = [
  'short_tasks',
  'admin',
  'recovery',
  'health',
  'critical_only',
];

export const VALID_STATE_TYPES: readonly StateType[] = [
  'clear',
  'neutral',
  'low',
  'stressed',
  'restless',
  'overloaded',
];

export type NeedsProfilePatch = Partial<Omit<NeedsProfile, 'id' | 'createdAt' | 'updatedAt'>>;

export function isValidQuietHour(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function activeDatabase(database?: NowWhatDB): NowWhatDB {
  return database ?? db;
}

async function getSettingsQuietHours(database: NowWhatDB): Promise<Pick<NeedsProfile, 'quietHoursStart' | 'quietHoursEnd'>> {
  const settings = await database.settings.toArray() as Settings[];
  const current = settings[0];
  return {
    quietHoursStart: isValidQuietHour(current?.quietHoursStart) ? current.quietHoursStart : DEFAULT_QUIET_HOURS_START,
    quietHoursEnd: isValidQuietHour(current?.quietHoursEnd) ? current.quietHoursEnd : DEFAULT_QUIET_HOURS_END,
  };
}

async function createDefaultNeedsProfile(database: NowWhatDB): Promise<NeedsProfile> {
  const now = new Date().toISOString();
  const quietHours = await getSettingsQuietHours(database);

  return {
    id: NEEDS_PROFILE_ID,
    selectedNeeds: [],
    priorityMode: 'easy_start',
    lowEnergyPreference: 'short_tasks',
    checkInEnabled: false,
    checkInIntervalHours: DEFAULT_CHECK_IN_INTERVAL_HOURS,
    ...quietHours,
    stateCheckDismissCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getNeedsProfile(database?: NowWhatDB): Promise<NeedsProfile | null> {
  return await activeDatabase(database).needsProfiles.get(NEEDS_PROFILE_ID) ?? null;
}

export async function getOrCreateNeedsProfile(database?: NowWhatDB): Promise<NeedsProfile> {
  const activeDb = activeDatabase(database);
  const existing = await getNeedsProfile(activeDb);
  if (existing) return existing;

  const profile = await createDefaultNeedsProfile(activeDb);
  await activeDb.needsProfiles.put(profile as never);
  return profile;
}

export async function updateNeedsProfile(
  patch: NeedsProfilePatch,
  database?: NowWhatDB
): Promise<NeedsProfile> {
  const activeDb = activeDatabase(database);
  const current = await getOrCreateNeedsProfile(activeDb);
  const next: NeedsProfile = {
    ...current,
    ...patch,
    id: NEEDS_PROFILE_ID,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await activeDb.needsProfiles.put(next as never);
  return next;
}

export async function resetNeedsProfile(database?: NowWhatDB): Promise<NeedsProfile> {
  const activeDb = activeDatabase(database);
  const profile = await createDefaultNeedsProfile(activeDb);
  await activeDb.needsProfiles.put(profile as never);
  return profile;
}

export async function hasCompletedNeedsOnboarding(database?: NowWhatDB): Promise<boolean> {
  const profile = await getNeedsProfile(database);
  return Boolean(profile?.onboardingCompletedAt);
}

export async function markNeedsOnboardingComplete(database?: NowWhatDB): Promise<NeedsProfile> {
  return updateNeedsProfile({
    onboardingCompletedAt: new Date().toISOString(),
    onboardingDismissedAt: undefined,
  }, database);
}

export async function dismissNeedsOnboarding(database?: NowWhatDB): Promise<NeedsProfile> {
  return updateNeedsProfile({
    onboardingDismissedAt: new Date().toISOString(),
  }, database);
}

export async function scheduleNextStateCheck(
  fromDate: Date = new Date(),
  database?: NowWhatDB
): Promise<NeedsProfile> {
  const profile = await getOrCreateNeedsProfile(database);
  const nextStateCheckAt = new Date(
    fromDate.getTime() + profile.checkInIntervalHours * 60 * 60 * 1000
  ).toISOString();

  return updateNeedsProfile({ nextStateCheckAt }, database);
}

export async function clearNeedsProfile(database?: NowWhatDB): Promise<void> {
  await activeDatabase(database).needsProfiles.clear();
}
