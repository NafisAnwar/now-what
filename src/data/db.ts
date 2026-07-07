import Dexie, { type Table } from 'dexie';
import type { Task, Habit, Goal, CalendarBlock, ActivityLog, DailyPlan, Suggestion, DailyReview, WeeklyReview, Settings, Reminder } from '../types';

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

  constructor() {
    super('nowwhat_db');
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
  }
}

export const db = new NowWhatDB();
