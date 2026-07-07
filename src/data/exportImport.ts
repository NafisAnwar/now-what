import { db } from './db';
import { PROFILE_SCHEMA_VERSION } from './db';
import { getActiveProfileRecord } from './profile';
import type { Task, Habit, Goal, CalendarBlock, ActivityLog, DailyPlan, Suggestion, DailyReview, WeeklyReview, Settings, Reminder } from '../types';

export const EXPORT_VERSION = 2;
export const SCHEMA_VERSION = PROFILE_SCHEMA_VERSION;
export const APP_NAME = 'NOW_WHAT?';
const MANUAL_CLEAR_KEY = 'nowwhat_manual_clear';
const STORE_NAMES = [
  'tasks', 'habits', 'goals', 'calendarBlocks', 'activityLogs',
  'dailyPlans', 'suggestions', 'dailyReviews', 'weeklyReviews', 'settings', 'reminders',
] as const;

export interface BackupProfile {
  id: string;
  displayName: string;
  createdAt: string;
  deviceLabel?: string;
}

export interface NowWhatBackup {
  app: string;
  exportVersion: number;
  schemaVersion: number;
  exportedAt: string;
  profile: BackupProfile;
  stores: {
    tasks: Task[];
    habits: Habit[];
    goals: Goal[];
    calendarBlocks: CalendarBlock[];
    activityLogs: ActivityLog[];
    dailyPlans: DailyPlan[];
    suggestions: Suggestion[];
    dailyReviews: DailyReview[];
    weeklyReviews: WeeklyReview[];
    settings: Settings[];
    reminders: Reminder[];
  };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  backup?: NowWhatBackup;
  summary?: ImportSummary;
}

export interface ImportSummary {
  tasks: number;
  habits: number;
  goals: number;
  calendarBlocks: number;
  activityLogs: number;
  dailyPlans: number;
  suggestions: number;
  dailyReviews: number;
  weeklyReviews: number;
  settings: number;
  reminders: number;
}

function normalizeBackupProfile(value: unknown, exportedAt: string): BackupProfile {
  if (!value || typeof value !== 'object') {
    return {
      id: 'legacy',
      displayName: 'Legacy Backup',
      createdAt: exportedAt,
    };
  }

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : 'legacy';
  const displayName = typeof raw.displayName === 'string' && raw.displayName.trim()
    ? raw.displayName
    : 'Local Profile';
  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.trim()
    ? raw.createdAt
    : exportedAt;
  const deviceLabel = typeof raw.deviceLabel === 'string' && raw.deviceLabel.trim()
    ? raw.deviceLabel
    : undefined;

  return {
    id,
    displayName,
    createdAt,
    deviceLabel,
  };
}

// ── Settings helpers ────────────────────────────────────────────────────────

async function getOrCreateSettings(): Promise<Settings> {
  const all = await db.settings.toArray() as Settings[];
  if (all.length > 0) return all[0];
  const profile = await getActiveProfileRecord();
  const now = new Date().toISOString();
  const s: Settings = {
    id: crypto.randomUUID(),
    theme: 'dark',
    appVersion: '0.9.0',
    schemaVersion: SCHEMA_VERSION,
    localProfileId: profile?.id,
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.add(s as never);
  return s;
}

async function touchSettings(updates: Partial<Settings>): Promise<void> {
  const s = await getOrCreateSettings();
  await db.settings.update(s.id, { ...updates, updatedAt: new Date().toISOString() } as never);
}

export async function getSettingsInfo(): Promise<Settings> {
  return getOrCreateSettings();
}

// ── Export ──────────────────────────────────────────────────────────────────

export async function exportDatabase(): Promise<void> {
  const profile = await getActiveProfileRecord();
  const [
    tasks, habits, goals, calendarBlocks, activityLogs,
    dailyPlans, suggestions, dailyReviews, weeklyReviews, settings, reminders,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.habits.toArray(),
    db.goals.toArray(),
    db.calendarBlocks.toArray(),
    db.activityLogs.toArray(),
    db.dailyPlans.toArray(),
    db.suggestions.toArray(),
    db.dailyReviews.toArray(),
    db.weeklyReviews.toArray(),
    db.settings.toArray(),
    db.reminders.toArray(),
  ]);

  const exportedAt = new Date().toISOString();
  const backupProfile: BackupProfile = profile
    ? {
        id: profile.id,
        displayName: profile.displayName,
        createdAt: profile.createdAt,
        deviceLabel: profile.deviceLabel,
      }
    : {
        id: 'unknown',
        displayName: 'Local Profile',
        createdAt: exportedAt,
      };

  const backup: NowWhatBackup = {
    app: APP_NAME,
    exportVersion: EXPORT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    profile: backupProfile,
    stores: {
      tasks: tasks as Task[],
      habits: habits as Habit[],
      goals: goals as Goal[],
      calendarBlocks: calendarBlocks as CalendarBlock[],
      activityLogs: activityLogs as ActivityLog[],
      dailyPlans: dailyPlans as DailyPlan[],
      suggestions: suggestions as Suggestion[],
      dailyReviews: dailyReviews as DailyReview[],
      weeklyReviews: weeklyReviews as WeeklyReview[],
      settings: settings as Settings[],
      reminders: reminders as Reminder[],
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const datePart = exportedAt.slice(0, 10);
  const timePart = exportedAt.slice(11, 16).replace(':', '-');
  const filename = `now_what_backup_${datePart}_${timePart}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  await touchSettings({ lastExportAt: exportedAt });
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateBackup(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Backup structure not recognized.' };
  }
  const obj = data as Record<string, unknown>;

  if (obj.app !== APP_NAME) {
    return { valid: false, reason: 'Backup structure not recognized.' };
  }
  // Accept backups from schema versions 1 and 2 (v1 has no reminders — safe to import as empty)
  if (!Number.isInteger(obj.schemaVersion) || (obj.schemaVersion as number) < 1 || (obj.schemaVersion as number) > SCHEMA_VERSION) {
    return { valid: false, reason: 'Backup schema not supported.' };
  }
  if (!obj.stores || typeof obj.stores !== 'object') {
    return { valid: false, reason: 'Backup structure not recognized.' };
  }

  const stores = obj.stores as Record<string, unknown>;
  const schemaVersion = obj.schemaVersion as number;

  for (const name of STORE_NAMES) {
    const value = stores[name];
    if (value === undefined) {
      if (name === 'reminders' && schemaVersion < 2) continue;
      return { valid: false, reason: `Backup is missing the ${name} store.` };
    }
    if (!Array.isArray(value)) {
      return { valid: false, reason: 'Backup structure not recognized.' };
    }

    const ids = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string' || !(item as { id: string }).id.trim()) {
        return { valid: false, reason: `Backup has invalid records in the ${name} store.` };
      }
      const id = (item as { id: string }).id;
      if (ids.has(id)) {
        return { valid: false, reason: `Backup has duplicate IDs in the ${name} store.` };
      }
      ids.add(id);
    }
  }

  const safeArr = (key: string): unknown[] =>
    Array.isArray(stores[key]) ? (stores[key] as unknown[]) : [];

  const backup: NowWhatBackup = {
    app: APP_NAME,
    exportVersion: typeof obj.exportVersion === 'number' ? obj.exportVersion : 1,
    schemaVersion: obj.schemaVersion as number,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    profile: normalizeBackupProfile(obj.profile, typeof obj.exportedAt === 'string' ? obj.exportedAt : ''),
    stores: {
      tasks: safeArr('tasks') as Task[],
      habits: safeArr('habits') as Habit[],
      goals: safeArr('goals') as Goal[],
      calendarBlocks: safeArr('calendarBlocks') as CalendarBlock[],
      activityLogs: safeArr('activityLogs') as ActivityLog[],
      dailyPlans: safeArr('dailyPlans') as DailyPlan[],
      suggestions: safeArr('suggestions') as Suggestion[],
      dailyReviews: safeArr('dailyReviews') as DailyReview[],
      weeklyReviews: safeArr('weeklyReviews') as WeeklyReview[],
      settings: safeArr('settings') as Settings[],
      reminders: safeArr('reminders') as Reminder[],
    },
  };

  const summary: ImportSummary = {
    tasks: backup.stores.tasks.length,
    habits: backup.stores.habits.length,
    goals: backup.stores.goals.length,
    calendarBlocks: backup.stores.calendarBlocks.length,
    activityLogs: backup.stores.activityLogs.length,
    dailyPlans: backup.stores.dailyPlans.length,
    suggestions: backup.stores.suggestions.length,
    dailyReviews: backup.stores.dailyReviews.length,
    weeklyReviews: backup.stores.weeklyReviews.length,
    settings: backup.stores.settings.length,
    reminders: backup.stores.reminders.length,
  };

  return { valid: true, backup, summary };
}

// ── Restore ─────────────────────────────────────────────────────────────────

export async function restoreDatabase(backup: NowWhatBackup): Promise<void> {
  const { stores } = backup;
  const activeProfile = await getActiveProfileRecord();
  const importedAt = new Date().toISOString();
  const settingsForActiveProfile = stores.settings.map(setting => ({
    ...setting,
    localProfileId: activeProfile?.id,
    updatedAt: importedAt,
  }));

  await db.transaction('rw', [
    db.tasks, db.habits, db.goals, db.calendarBlocks, db.activityLogs,
    db.dailyPlans, db.suggestions, db.dailyReviews, db.weeklyReviews,
    db.settings, db.reminders,
  ], async () => {
    await Promise.all([
      db.tasks.clear(), db.habits.clear(), db.goals.clear(),
      db.calendarBlocks.clear(), db.activityLogs.clear(), db.dailyPlans.clear(),
      db.suggestions.clear(), db.dailyReviews.clear(), db.weeklyReviews.clear(),
      db.settings.clear(), db.reminders.clear(),
    ]);

    await Promise.all([
      stores.tasks.length > 0 ? db.tasks.bulkAdd(stores.tasks as never) : Promise.resolve(),
      stores.habits.length > 0 ? db.habits.bulkAdd(stores.habits as never) : Promise.resolve(),
      stores.goals.length > 0 ? db.goals.bulkAdd(stores.goals as never) : Promise.resolve(),
      stores.calendarBlocks.length > 0 ? db.calendarBlocks.bulkAdd(stores.calendarBlocks as never) : Promise.resolve(),
      stores.activityLogs.length > 0 ? db.activityLogs.bulkAdd(stores.activityLogs as never) : Promise.resolve(),
      stores.dailyPlans.length > 0 ? db.dailyPlans.bulkAdd(stores.dailyPlans as never) : Promise.resolve(),
      stores.suggestions.length > 0 ? db.suggestions.bulkAdd(stores.suggestions as never) : Promise.resolve(),
      stores.dailyReviews.length > 0 ? db.dailyReviews.bulkAdd(stores.dailyReviews as never) : Promise.resolve(),
      stores.weeklyReviews.length > 0 ? db.weeklyReviews.bulkAdd(stores.weeklyReviews as never) : Promise.resolve(),
      settingsForActiveProfile.length > 0 ? db.settings.bulkAdd(settingsForActiveProfile as never) : Promise.resolve(),
      stores.reminders.length > 0 ? db.reminders.bulkAdd(stores.reminders as never) : Promise.resolve(),
    ]);
  });

  await touchSettings({ lastImportAt: importedAt, localProfileId: activeProfile?.id });
  localStorage.setItem(MANUAL_CLEAR_KEY, '1');
}

// ── Clear ────────────────────────────────────────────────────────────────────

export async function clearAllStores(): Promise<void> {
  await db.transaction('rw', [
    db.tasks, db.habits, db.goals, db.calendarBlocks, db.activityLogs,
    db.dailyPlans, db.suggestions, db.dailyReviews, db.weeklyReviews,
    db.settings, db.reminders,
  ], async () => {
    await Promise.all([
      db.tasks.clear(), db.habits.clear(), db.goals.clear(),
      db.calendarBlocks.clear(), db.activityLogs.clear(), db.dailyPlans.clear(),
      db.suggestions.clear(), db.dailyReviews.clear(), db.weeklyReviews.clear(),
      db.settings.clear(), db.reminders.clear(),
    ]);
  });
}

export async function clearSuggestionsOnly(): Promise<void> {
  await db.suggestions.clear();
}
