import Dexie, { type Table } from 'dexie';
import type { Task, Habit, Goal, CalendarBlock, ActivityLog, DailyPlan, Suggestion, DailyReview, WeeklyReview, Settings, Reminder, NeedsProfile } from '../types';

export const DEFAULT_LEGACY_DB_NAME = 'nowwhat_db';
export const PROFILE_SCHEMA_VERSION = 3;

export class NowWhatDB extends Dexie {
  settings!: Table<Settings, string>;
  tasks!: Table<Task, string>;
  habits!: Table<Habit, string>;
  goals!: Table<Goal, string>;
  calendarBlocks!: Table<CalendarBlock, string>;
  activityLogs!: Table<ActivityLog, string>;
  dailyPlans!: Table<DailyPlan, string>;
  suggestions!: Table<Suggestion, string>;
  dailyReviews!: Table<DailyReview, string>;
  weeklyReviews!: Table<WeeklyReview, string>;
  reminders!: Table<Reminder, string>;
  needsProfiles!: Table<NeedsProfile, string>;

  constructor(dbName = DEFAULT_LEGACY_DB_NAME) {
    super(dbName);
    this.version(1).stores({
      settings: 'id',
      tasks: 'id, status, priority, dueDate, energyRequired, goalId, createdAt',
      habits: 'id, frequency, createdAt',
      goals: 'id, status, horizon, createdAt',
      calendarBlocks: 'id, startAt, endAt, createdAt',
      activityLogs: 'id, type, createdAt, relatedTaskId, relatedHabitId',
      dailyPlans: 'id, date, createdAt',
      suggestions: 'id, status, actionType, createdAt',
      dailyReviews: 'id, date, createdAt',
      weeklyReviews: 'id, weekStart, createdAt',
    });
    // Version 2: adds reminders store. Existing stores unchanged.
    this.version(2).stores({
      reminders: 'id, type, status, scheduledAt, targetId, targetType, createdAt',
    });
    // Version 3: adds profile-scoped recommendation preference data.
    this.version(3).stores({
      needsProfiles: 'id',
    });
  }
}

export let db: NowWhatDB = new NowWhatDB(DEFAULT_LEGACY_DB_NAME);

export function createProfileDb(dbName: string): NowWhatDB {
  return new NowWhatDB(dbName);
}

export function setActiveDb(nextDb: NowWhatDB): void {
  if (db !== nextDb) {
    db.close();
  }
  db = nextDb;
}

export function getActiveDb(): NowWhatDB {
  return db;
}

export function getActiveDbName(): string {
  return db.name;
}
