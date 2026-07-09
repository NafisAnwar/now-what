import { db } from './db';
import { getCalendarBlocksForDate } from './calendar';
import { hasReviewableActivity, isDailyReviewIncomplete } from './review';
import { getActiveProfileRecord } from './profile';
import type { Reminder, Settings, DailyReview } from '../types';
import { getTodayStr, localDateStr } from '../utils/dateUtils';

// Single-flight lock — prevents overlapping scheduler runs from duplicating reminders
let _schedulerRunning = false;

// ── Defaults ─────────────────────────────────────────────────────────────────

export const REMINDER_DEFAULTS = {
  remindersEnabled: true,
  browserNotificationsEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  hydrationRemindersEnabled: false,
  movementRemindersEnabled: false,
  reviewReminderEnabled: true,
  calendarRemindersEnabled: true,
  taskDueRemindersEnabled: true,
  habitWindowRemindersEnabled: true,
};

export type ReminderSettings = typeof REMINDER_DEFAULTS;

export async function getReminderSettings(): Promise<ReminderSettings> {
  const all = await db.settings.toArray() as Settings[];
  const s = all[0];
  if (!s) return { ...REMINDER_DEFAULTS };
  return {
    remindersEnabled: s.remindersEnabled ?? REMINDER_DEFAULTS.remindersEnabled,
    browserNotificationsEnabled: s.browserNotificationsEnabled ?? REMINDER_DEFAULTS.browserNotificationsEnabled,
    quietHoursStart: s.quietHoursStart ?? REMINDER_DEFAULTS.quietHoursStart,
    quietHoursEnd: s.quietHoursEnd ?? REMINDER_DEFAULTS.quietHoursEnd,
    hydrationRemindersEnabled: s.hydrationRemindersEnabled ?? REMINDER_DEFAULTS.hydrationRemindersEnabled,
    movementRemindersEnabled: s.movementRemindersEnabled ?? REMINDER_DEFAULTS.movementRemindersEnabled,
    reviewReminderEnabled: s.reviewReminderEnabled ?? REMINDER_DEFAULTS.reviewReminderEnabled,
    calendarRemindersEnabled: s.calendarRemindersEnabled ?? REMINDER_DEFAULTS.calendarRemindersEnabled,
    taskDueRemindersEnabled: s.taskDueRemindersEnabled ?? REMINDER_DEFAULTS.taskDueRemindersEnabled,
    habitWindowRemindersEnabled: s.habitWindowRemindersEnabled ?? REMINDER_DEFAULTS.habitWindowRemindersEnabled,
  };
}

export async function updateReminderSettings(updates: Partial<Settings>): Promise<void> {
  const all = await db.settings.toArray() as Settings[];
  const now = new Date().toISOString();
  if (all.length > 0) {
    await db.settings.update(all[0].id, { ...updates, updatedAt: now } as never);
  } else {
    const profile = await getActiveProfileRecord();
    await db.settings.add({
      id: crypto.randomUUID(),
      theme: 'dark',
      localProfileId: profile?.id,
      ...updates,
      createdAt: now,
      updatedAt: now,
    } as never);
  }
}

// ── Quiet hours ───────────────────────────────────────────────────────────────

export function isWithinQuietHours(quietStart = '22:00', quietEnd = '08:00'): boolean {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // Crosses midnight (e.g., 22:00 to 08:00)
  if (start > end) return current >= start || current <= end;
  return current >= start && current <= end;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getScheduledReminders(): Promise<Reminder[]> {
  return db.reminders.where('status').equals('scheduled').toArray() as Promise<Reminder[]>;
}

export async function getDueReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString();
  const active = await db.reminders
    .where('status').anyOf(['scheduled', 'sent'])
    .toArray() as Reminder[];
  return active.filter(r => r.enabled && r.scheduledAt <= now);
}

export async function markReminderSent(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.reminders.update(id, { status: 'sent', sentAt: now, updatedAt: now } as never);
  // Browser notification if opted-in
  const settings = await getReminderSettings();
  if (
    settings.browserNotificationsEnabled &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    const r = await db.reminders.get(id) as Reminder | undefined;
    if (r) new Notification(r.title, { body: r.message, silent: true });
  }
}

export async function dismissReminder(id: string): Promise<void> {
  await db.reminders.update(id, { status: 'dismissed', updatedAt: new Date().toISOString() } as never);
}

export async function completeReminder(id: string): Promise<void> {
  await db.reminders.update(id, { status: 'completed', updatedAt: new Date().toISOString() } as never);
}

export async function cancelReminder(id: string): Promise<void> {
  await db.reminders.update(id, { status: 'cancelled', updatedAt: new Date().toISOString() } as never);
}

export interface ManualReminderInput {
  title: string;
  date: string;
  time: string;
  note?: string;
}

export async function createManualReminder(input: ManualReminderInput): Promise<Reminder> {
  const title = input.title.trim();
  if (!title || !input.date || !input.time) {
    throw new Error('Manual reminder requires title, date, and time.');
  }

  const scheduledDate = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error('Manual reminder date/time is invalid.');
  }
  const scheduledAt = scheduledDate.toISOString();

  const note = input.note?.trim();
  const now = new Date().toISOString();
  const reminder: Reminder = {
    id: crypto.randomUUID(),
    type: 'manual',
    title,
    message: note || 'Manual reminder.',
    scheduledAt,
    status: 'scheduled',
    source: 'user',
    repeat: 'none',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.reminders.add(reminder as never);
  return reminder;
}

export async function clearOldReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const old = await db.reminders
    .where('status').anyOf(['sent', 'dismissed', 'completed', 'cancelled'])
    .filter(r => r.updatedAt < cutoff)
    .toArray() as Reminder[];
  if (old.length > 0) await db.reminders.bulkDelete(old.map(r => r.id));
}

// ── Dedup helper ─────────────────────────────────────────────────────────────

/**
 * Create a reminder only if no reminder of the same type + targetId was
 * already scheduled for today (any status). Prevents duplicate firing on
 * every scheduler tick.
 */
async function ensureReminder(
  todayStr: string,
  type: Reminder['type'],
  targetId: string | undefined,
  factory: () => Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const tid = targetId || 'none';
  // Compare using local date of scheduledAt (ISO is UTC, so .startsWith is wrong near midnight)
  const existing = await db.reminders
    .filter(r =>
      r.type === type &&
      (r.targetId || 'none') === tid &&
      localDateStr(new Date(r.scheduledAt)) === todayStr
    )
    .first() as Reminder | undefined;
  if (existing) return;

  const now = new Date().toISOString();
  const data = factory();
  await db.reminders.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now } as never);
}

// ── Main scheduler ────────────────────────────────────────────────────────────

export async function generateSystemRemindersForToday(): Promise<void> {
  if (_schedulerRunning) return;
  _schedulerRunning = true;
  try {
    const settings = await getReminderSettings();
    if (!settings.remindersEnabled) return;

    const todayStr = getTodayStr();
    const now = new Date();
    const nowMs = now.getTime();
    const nowISO = now.toISOString();
    const hour = now.getHours();
    const inQuiet = isWithinQuietHours(settings.quietHoursStart, settings.quietHoursEnd);

    // ── Cancel reminders whose tasks are now done ───────────────────────
    const doneTasks = await db.tasks.where('status').anyOf(['complete', 'skipped', 'missed']).toArray();
    for (const task of doneTasks) {
      const active = await db.reminders
        .filter(r => r.targetId === task.id && (r.status === 'scheduled' || r.status === 'sent'))
        .toArray() as Reminder[];
      for (const r of active) {
        await db.reminders.update(r.id, { status: 'cancelled', updatedAt: nowISO } as never);
      }
    }

    // ── Cancel reminders whose habits are completed today ───────────────
    const allHabits = await db.habits.toArray();
    for (const habit of allHabits) {
      const completedToday = habit.completionHistory.some(c => c.date === todayStr);
      if (!completedToday) continue;
      const active = await db.reminders
        .filter(r => r.targetId === habit.id && r.type === 'habit_window' && (r.status === 'scheduled' || r.status === 'sent'))
        .toArray() as Reminder[];
      for (const r of active) {
        await db.reminders.update(r.id, { status: 'cancelled', updatedAt: nowISO } as never);
      }
    }

    // ── Cancel daily_review reminder if today's review is complete ──────
    const todayReviewStatus = await db.dailyReviews.where('date').equals(todayStr).first() as { status?: string } | undefined;
    if (todayReviewStatus?.status === 'complete') {
      const active = await db.reminders
        .filter(r => r.type === 'daily_review' && (r.status === 'scheduled' || r.status === 'sent') && localDateStr(new Date(r.scheduledAt)) === todayStr)
        .toArray() as Reminder[];
      for (const r of active) {
        await db.reminders.update(r.id, { status: 'cancelled', updatedAt: nowISO } as never);
      }
    }

    // ── Cancel previous_review reminder if yesterday's review is complete
    {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yrStr = localDateStr(yesterday);
      const yrStatus = await db.dailyReviews.where('date').equals(yrStr).first() as { status?: string } | undefined;
      if (yrStatus?.status === 'complete') {
        const active = await db.reminders
          .filter(r => r.type === 'previous_review' && (r.status === 'scheduled' || r.status === 'sent') && localDateStr(new Date(r.scheduledAt)) === todayStr)
          .toArray() as Reminder[];
        for (const r of active) {
          await db.reminders.update(r.id, { status: 'cancelled', updatedAt: nowISO } as never);
        }
      }
    }

    // ── 4.1 Task due reminders ──────────────────────────────────────────
    if (settings.taskDueRemindersEnabled) {
      const pending = await db.tasks.where('status').equals('pending').toArray();
      for (const task of pending) {
        if (!task.dueDate) continue;
        const overdue = task.dueDate < todayStr;
        const dueToday = task.dueDate === todayStr;
        if (!overdue && !dueToday) continue;
        const critical = task.priority === 'critical';
        // Critical overdue tasks bypass quiet hours; others respect them
        if (inQuiet && !(overdue && critical)) continue;

        await ensureReminder(todayStr, 'task_due', task.id, () => ({
          type: 'task_due',
          title: overdue ? `Overdue: ${task.title}` : `Task due today: ${task.title}`,
          message: overdue
            ? `${task.title} was due ${task.dueDate}. Still pending.`
            : `Task due soon: ${task.title}.`,
          targetType: 'task',
          targetId: task.id,
          scheduledAt: nowISO,
          status: 'scheduled',
          source: 'system',
          repeat: 'none',
          enabled: true,
        }));
      }
    }

    // ── 4.2 Habit window reminders ──────────────────────────────────────
    if (settings.habitWindowRemindersEnabled && !inQuiet) {
      const nowHHMM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      for (const habit of allHabits) {
        if (habit.frequency !== 'daily') continue;
        if (habit.completionHistory.some(c => c.date === todayStr)) continue;
        if (!habit.timeWindowStart || !habit.timeWindowEnd) continue;
        // Window must be open now
        if (nowHHMM < habit.timeWindowStart || nowHHMM > habit.timeWindowEnd) continue;
        // Closing within 30 min
        const [eh, em] = habit.timeWindowEnd.split(':').map(Number);
        const minsUntilClose = (eh * 60 + em) - (hour * 60 + now.getMinutes());
        if (minsUntilClose > 30 || minsUntilClose < 0) continue;

        await ensureReminder(todayStr, 'habit_window', habit.id, () => ({
          type: 'habit_window',
          title: `Habit window closing: ${habit.name}`,
          message: `Habit window closes at ${habit.timeWindowEnd}. Still pending.`,
          targetType: 'habit',
          targetId: habit.id,
          scheduledAt: nowISO,
          status: 'scheduled',
          source: 'system',
          repeat: 'none',
          enabled: true,
        }));
      }
    }

    // ── 4.3 Calendar block reminders (15 min before) ────────────────────
    if (settings.calendarRemindersEnabled && !inQuiet) {
      const todayBlocks = await getCalendarBlocksForDate(db, todayStr);
      for (const block of todayBlocks) {
        const startMs = new Date(block.startAt).getTime();
        const minsBefore = (startMs - nowMs) / 60000;
        if (minsBefore < 0 || minsBefore > 20) continue;

        await ensureReminder(todayStr, 'calendar_block', block.id, () => ({
          type: 'calendar_block',
          title: `Calendar block starts in ${Math.round(minsBefore)} min: ${block.title}`,
          message: `${block.title} starts at ${block.startAt.split('T')[1]?.slice(0, 5) ?? ''}.`,
          targetType: 'calendarBlock',
          targetId: block.id,
          scheduledAt: nowISO,
          status: 'scheduled',
          source: 'system',
          repeat: 'none',
          enabled: true,
        }));
      }
    }

    // ── 4.4 Daily review reminder (after 20:00) ─────────────────────────
    if (settings.reviewReminderEnabled && !inQuiet && hour >= 20) {
      const todayReview = await db.dailyReviews.where('date').equals(todayStr).first() as DailyReview | undefined;
      if (todayReview?.status !== 'complete') {
        const hasActivity = await hasReviewableActivity(todayStr);
        if (hasActivity) {
          await ensureReminder(todayStr, 'daily_review', undefined, () => ({
            type: 'daily_review',
            title: 'Daily review available.',
            message: 'Today has logged activity. Review is ready.',
            targetType: 'review',
            scheduledAt: nowISO,
            status: 'scheduled',
            source: 'system',
            repeat: 'none',
            enabled: true,
          }));
        }
      }
    }

    // ── 4.5 Previous review reminder (respects quiet hours) ─────────────
    if (settings.reviewReminderEnabled && !inQuiet) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = localDateStr(yesterday);
      const previousReviewIncomplete = await isDailyReviewIncomplete(yesterdayStr);
      if (previousReviewIncomplete) {
        await ensureReminder(todayStr, 'previous_review', undefined, () => ({
          type: 'previous_review',
          title: 'Previous review incomplete.',
          message: `Review for ${yesterdayStr} is not complete.`,
          targetType: 'review',
          scheduledAt: nowISO,
          status: 'scheduled',
          source: 'system',
          repeat: 'none',
          enabled: true,
        }));
      }
    }

    // ── 4.6 Hydration reminder ──────────────────────────────────────────
    if (settings.hydrationRemindersEnabled && !inQuiet && hour >= 8) {
      const waterToday = await db.activityLogs.filter(l => l.type === 'water' && localDateStr(new Date(l.createdAt)) === todayStr).toArray();
      const lastMs = waterToday.length > 0
        ? Math.max(...waterToday.map(l => new Date(l.createdAt).getTime()))
        : 0;
      const minsSince = lastMs > 0 ? (nowMs - lastMs) / 60000 : Infinity;
      if (minsSince >= 180) {
        // Don't create if one already exists in the last 3 hours
        const recent = await db.reminders
          .filter(r =>
            r.type === 'hydration' &&
            r.status !== 'dismissed' && r.status !== 'completed' && r.status !== 'cancelled' &&
            r.scheduledAt >= new Date(nowMs - 3 * 60 * 60 * 1000).toISOString()
          )
          .first() as Reminder | undefined;
        if (!recent) {
          const ts = new Date().toISOString();
          await db.reminders.add({
            id: crypto.randomUUID(),
            type: 'hydration',
            title: 'No water logged recently.',
            message: 'No water has been logged in the past 3 hours.',
            targetType: 'quickLog',
            scheduledAt: ts,
            status: 'scheduled',
            source: 'system',
            repeat: 'none',
            enabled: true,
            createdAt: ts,
            updatedAt: ts,
          } as never);
        }
      }
    }

    // ── 4.7 Movement reminder ────────────────────────────────────────────
    if (settings.movementRemindersEnabled && !inQuiet && hour >= 14) {
      const movement = await db.activityLogs.filter(l => l.type === 'exercise' && localDateStr(new Date(l.createdAt)) === todayStr).toArray();
      if (movement.length === 0) {
        await ensureReminder(todayStr, 'movement', undefined, () => ({
          type: 'movement',
          title: 'No movement logged today.',
          message: 'No exercise or movement has been logged yet.',
          targetType: 'quickLog',
          scheduledAt: nowISO,
          status: 'scheduled',
          source: 'system',
          repeat: 'none',
          enabled: true,
        }));
      }
    }

    // Housekeeping
    await clearOldReminders();
  } catch (err) {
    console.error('[reminders] scheduler error:', err);
  } finally {
    _schedulerRunning = false;
  }
}
