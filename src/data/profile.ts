import Dexie, { type Table } from 'dexie';
import type { Settings } from '../types';
import { APP_VERSION } from '../constants/version';
import {
  DEFAULT_LEGACY_DB_NAME,
  PROFILE_SCHEMA_VERSION,
  type NowWhatDB,
  createProfileDb,
  getActiveDb,
  setActiveDb,
} from './db';
import { getOrCreateNeedsProfile } from './needsProfile';

export interface LocalProfile {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  dbName: string;
  schemaVersion: number;
  deviceLabel?: string;
}

export interface AppMeta {
  key: string;
  value: string;
}

class NowWhatMetaDB extends Dexie {
  profiles!: Table<LocalProfile, string>;
  appMeta!: Table<AppMeta, string>;

  constructor() {
    super('nowwhat_meta');
    this.version(1).stores({
      profiles: 'id, dbName, createdAt, lastOpenedAt',
      appMeta: 'key',
    });
  }
}

export const metaDb = new NowWhatMetaDB();

const ACTIVE_PROFILE_KEY = 'activeProfileId';
const LEGACY_MIGRATION_KEY_PREFIX = 'legacyMigration';
export function getProfileDbName(profileId: string): string {
  return `nowwhat_profile_${profileId}`;
}

async function getMetaValue(key: string): Promise<string | null> {
  const record = await metaDb.appMeta.get(key);
  return record?.value ?? null;
}

async function setMetaValue(key: string, value: string): Promise<void> {
  await metaDb.appMeta.put({ key, value });
}

async function setActiveProfileId(profileId: string): Promise<void> {
  await setMetaValue(ACTIVE_PROFILE_KEY, profileId);
}

async function createLocalProfile(): Promise<LocalProfile> {
  const now = new Date().toISOString();
  const id = `nwloc_${crypto.randomUUID()}`;
  const profile: LocalProfile = {
    id,
    displayName: 'Local Profile',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    dbName: getProfileDbName(id),
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };

  await metaDb.profiles.add(profile);
  await setActiveProfileId(profile.id);
  return profile;
}

async function resolveActiveProfile(): Promise<LocalProfile> {
  const activeProfileId = await getMetaValue(ACTIVE_PROFILE_KEY);
  let profile = activeProfileId ? await metaDb.profiles.get(activeProfileId) : undefined;

  if (!profile) {
    const existingProfiles = await metaDb.profiles.orderBy('createdAt').toArray();
    profile = existingProfiles[0] ?? await createLocalProfile();
    await setActiveProfileId(profile.id);
  }

  const now = new Date().toISOString();
  const updated: LocalProfile = {
    ...profile,
    lastOpenedAt: now,
    updatedAt: now,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    dbName: profile.dbName || getProfileDbName(profile.id),
  };

  await metaDb.profiles.put(updated);
  return updated;
}

async function getTotalRecordCount(database: NowWhatDB): Promise<number> {
  const counts = await Promise.all([
    database.settings.count(),
    database.tasks.count(),
    database.habits.count(),
    database.goals.count(),
    database.calendarBlocks.count(),
    database.activityLogs.count(),
    database.dailyPlans.count(),
    database.suggestions.count(),
    database.dailyReviews.count(),
    database.weeklyReviews.count(),
    database.reminders.count(),
    database.needsProfiles.count(),
  ]);

  return counts.reduce((sum, count) => sum + count, 0);
}

async function copyLegacyDataIntoProfile(profile: LocalProfile, profileDb: NowWhatDB): Promise<void> {
  const migrationKey = `${LEGACY_MIGRATION_KEY_PREFIX}:${profile.id}`;
  const existingMigration = await getMetaValue(migrationKey);
  if (existingMigration) return;

  const profileRecordCount = await getTotalRecordCount(profileDb);
  if (profileRecordCount > 0) {
    await setMetaValue(migrationKey, 'skipped_profile_not_empty');
    return;
  }

  const legacyExists = await Dexie.exists(DEFAULT_LEGACY_DB_NAME);
  if (!legacyExists) {
    await setMetaValue(migrationKey, 'no_legacy_db');
    return;
  }

  const legacyDb = createProfileDb(DEFAULT_LEGACY_DB_NAME);
  try {
    await legacyDb.open();
    const legacyRecordCount = await getTotalRecordCount(legacyDb);
    if (legacyRecordCount === 0) {
      await setMetaValue(migrationKey, 'legacy_empty');
      return;
    }

    const [
      settings,
      tasks,
      habits,
      goals,
      calendarBlocks,
      activityLogs,
      dailyPlans,
      suggestions,
      dailyReviews,
      weeklyReviews,
      reminders,
      needsProfiles,
    ] = await Promise.all([
      legacyDb.settings.toArray(),
      legacyDb.tasks.toArray(),
      legacyDb.habits.toArray(),
      legacyDb.goals.toArray(),
      legacyDb.calendarBlocks.toArray(),
      legacyDb.activityLogs.toArray(),
      legacyDb.dailyPlans.toArray(),
      legacyDb.suggestions.toArray(),
      legacyDb.dailyReviews.toArray(),
      legacyDb.weeklyReviews.toArray(),
      legacyDb.reminders.toArray(),
      legacyDb.needsProfiles.toArray(),
    ]);

    await profileDb.transaction('rw', [
      profileDb.settings,
      profileDb.tasks,
      profileDb.habits,
      profileDb.goals,
      profileDb.calendarBlocks,
      profileDb.activityLogs,
      profileDb.dailyPlans,
      profileDb.suggestions,
      profileDb.dailyReviews,
      profileDb.weeklyReviews,
      profileDb.reminders,
      profileDb.needsProfiles,
    ], async () => {
      if (settings.length > 0) await profileDb.settings.bulkAdd(settings as never);
      if (tasks.length > 0) await profileDb.tasks.bulkAdd(tasks as never);
      if (habits.length > 0) await profileDb.habits.bulkAdd(habits as never);
      if (goals.length > 0) await profileDb.goals.bulkAdd(goals as never);
      if (calendarBlocks.length > 0) await profileDb.calendarBlocks.bulkAdd(calendarBlocks as never);
      if (activityLogs.length > 0) await profileDb.activityLogs.bulkAdd(activityLogs as never);
      if (dailyPlans.length > 0) await profileDb.dailyPlans.bulkAdd(dailyPlans as never);
      if (suggestions.length > 0) await profileDb.suggestions.bulkAdd(suggestions as never);
      if (dailyReviews.length > 0) await profileDb.dailyReviews.bulkAdd(dailyReviews as never);
      if (weeklyReviews.length > 0) await profileDb.weeklyReviews.bulkAdd(weeklyReviews as never);
      if (reminders.length > 0) await profileDb.reminders.bulkAdd(reminders as never);
      if (needsProfiles.length > 0) await profileDb.needsProfiles.bulkAdd(needsProfiles as never);
    });

    await setMetaValue(migrationKey, 'copied');
  } finally {
    legacyDb.close();
  }
}

export async function getActiveProfileRecord(): Promise<LocalProfile | null> {
  const activeProfileId = await getMetaValue(ACTIVE_PROFILE_KEY);
  if (!activeProfileId) return null;
  return await metaDb.profiles.get(activeProfileId) ?? null;
}

export async function ensureProfileSettings(profile: LocalProfile): Promise<Settings> {
  const activeDb = getActiveDb();
  const settings = await activeDb.settings.toArray() as Settings[];
  const now = new Date().toISOString();

  if (settings.length === 0) {
    const newSettings: Settings = {
      id: crypto.randomUUID(),
      theme: 'dark',
      appVersion: APP_VERSION,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      localProfileId: profile.id,
      createdAt: now,
      updatedAt: now,
    };
    await activeDb.settings.add(newSettings as never);
    return newSettings;
  }

  const current = settings[0];
  const updates: Partial<Settings> = {};
  if (current.localProfileId !== profile.id) updates.localProfileId = profile.id;
  if (current.schemaVersion !== PROFILE_SCHEMA_VERSION) updates.schemaVersion = PROFILE_SCHEMA_VERSION;
  if (current.appVersion !== APP_VERSION) updates.appVersion = APP_VERSION;

  if (Object.keys(updates).length > 0) {
    await activeDb.settings.update(current.id, { ...updates, updatedAt: now } as never);
    return { ...current, ...updates, updatedAt: now };
  }

  return current;
}

export async function initializeProfileSession(): Promise<LocalProfile> {
  await metaDb.open();
  const profile = await resolveActiveProfile();
  const profileDb = createProfileDb(profile.dbName);

  setActiveDb(profileDb);
  await profileDb.open();
  await copyLegacyDataIntoProfile(profile, profileDb);
  await ensureProfileSettings(profile);
  await getOrCreateNeedsProfile(profileDb);

  return profile;
}
