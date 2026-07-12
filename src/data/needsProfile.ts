import { db, type NowWhatDB } from './db';
import type {
  ActivityLog,
  LowEnergyPreference,
  NeedType,
  NeedsProfile,
  PriorityMode,
  Settings,
  StateType,
  UserEnergyLevel,
} from '../types';

export const NEEDS_PROFILE_ID = 'default';
export const DEFAULT_CHECK_IN_INTERVAL_HOURS = 6;
export const DEFAULT_QUIET_HOURS_START = '23:00';
export const DEFAULT_QUIET_HOURS_END = '08:00';
const HOUR_MS = 60 * 60 * 1000;

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

export function isValidUserEnergyLevel(value: unknown): value is UserEnergyLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export type NeedsProfilePatch = Partial<Omit<NeedsProfile, 'id' | 'createdAt' | 'updatedAt'>>;

export interface SaveStateCheckResult {
  log: ActivityLog;
  profile: NeedsProfile;
}

export function isValidQuietHour(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isWithinNeedsQuietHours(date: Date, quietStart: string, quietEnd: string): boolean {
  const current = date.getHours() * 60 + date.getMinutes();
  const start = timeToMinutes(quietStart);
  const end = timeToMinutes(quietEnd);

  if (start === end) return false;
  if (start > end) return current >= start || current < end;
  return current >= start && current < end;
}

export function getQuietHoursEnd(date: Date, quietEnd: string): Date {
  const [hours, minutes] = quietEnd.split(':').map(Number);
  const end = new Date(date);
  end.setHours(hours, minutes, 0, 0);
  if (end.getTime() <= date.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

function moveOutsideQuietHours(date: Date, profile: NeedsProfile): Date {
  return isWithinNeedsQuietHours(date, profile.quietHoursStart, profile.quietHoursEnd)
    ? getQuietHoursEnd(date, profile.quietHoursEnd)
    : date;
}

export function getStateCheckIntervalHours(
  profile: Pick<NeedsProfile, 'checkInIntervalHours'>,
  dismissCount = 0
): number {
  return dismissCount >= 2
    ? Math.max(12, profile.checkInIntervalHours * 2)
    : profile.checkInIntervalHours;
}

function calculateNextStateCheck(
  profile: NeedsProfile,
  fromDate: Date,
  dismissCount = 0
): Date {
  const intervalHours = getStateCheckIntervalHours(profile, dismissCount);
  return moveOutsideQuietHours(
    new Date(fromDate.getTime() + intervalHours * HOUR_MS),
    profile
  );
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
  if (!profile.checkInEnabled) {
    return updateNeedsProfile({ nextStateCheckAt: undefined }, database);
  }

  const nextStateCheckAt = calculateNextStateCheck(profile, fromDate).toISOString();

  return updateNeedsProfile({ nextStateCheckAt }, database);
}

export async function deferStateCheckUntil(
  date: Date,
  database?: NowWhatDB
): Promise<NeedsProfile> {
  const profile = await getOrCreateNeedsProfile(database);
  const nextStateCheckAt = moveOutsideQuietHours(date, profile).toISOString();
  return updateNeedsProfile({ nextStateCheckAt }, database);
}

export async function deferStateCheckForQuietHours(
  fromDate: Date = new Date(),
  database?: NowWhatDB
): Promise<NeedsProfile> {
  const profile = await getOrCreateNeedsProfile(database);
  return updateNeedsProfile({
    nextStateCheckAt: getQuietHoursEnd(fromDate, profile.quietHoursEnd).toISOString(),
  }, database);
}

export async function saveStateCheck(
  state: StateType,
  energyLevel: UserEnergyLevel,
  database?: NowWhatDB
): Promise<SaveStateCheckResult> {
  const activeDb = activeDatabase(database);
  const current = await getOrCreateNeedsProfile(activeDb);
  const now = new Date();
  const nowIso = now.toISOString();
  const nextStateCheckAt = calculateNextStateCheck(current, now).toISOString();
  const log: ActivityLog = {
    id: crypto.randomUUID(),
    type: 'state_check',
    label: `State check - ${state.toUpperCase()} - energy ${energyLevel}/5`,
    state,
    energyLevel,
    createdAt: nowIso,
  };
  const profile: NeedsProfile = {
    ...current,
    lastStateCheckAt: nowIso,
    nextStateCheckAt,
    stateCheckDismissCount: 0,
    updatedAt: nowIso,
  };

  await activeDb.transaction('rw', activeDb.activityLogs, activeDb.needsProfiles, async () => {
    await activeDb.activityLogs.add(log);
    await activeDb.needsProfiles.put(profile as never);
  });

  return { log, profile };
}

export async function dismissStateCheck(
  fromDate: Date = new Date(),
  database?: NowWhatDB
): Promise<NeedsProfile> {
  const profile = await getOrCreateNeedsProfile(database);
  const dismissCount = (profile.stateCheckDismissCount ?? 0) + 1;
  return updateNeedsProfile({
    stateCheckDismissCount: dismissCount,
    nextStateCheckAt: calculateNextStateCheck(profile, fromDate, dismissCount).toISOString(),
  }, database);
}

export async function clearNeedsProfile(database?: NowWhatDB): Promise<void> {
  await activeDatabase(database).needsProfiles.clear();
}
