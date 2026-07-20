import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { db } from '../../data/db';
import type { Reminder, Settings } from '../../types';
import {
  markReminderSent,
  dismissReminder,
  completeReminder,
  REMINDER_DEFAULTS,
} from '../../data/reminders';
import { completeHabit } from '../../data/completions';

export default function InAppReminderTray() {
  const [, navigate] = useLocation();
  const markedRef = useRef<Set<string>>(new Set());
  const actionInFlightRef = useRef<Set<string>>(new Set());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Respect global remindersEnabled setting
  const remindersEnabled = useLiveQuery(async () => {
    const all = await db.settings.toArray() as Settings[];
    return all[0]?.remindersEnabled ?? REMINDER_DEFAULTS.remindersEnabled;
  }, []);

  // Get due reminders (scheduled or sent, enabled, scheduledAt <= now)
  const dueReminders = useLiveQuery(async () => {
    const now = new Date().toISOString();
    const active = await db.reminders
      .where('status').anyOf(['scheduled', 'sent'])
      .toArray() as Reminder[];
    return active.filter(r => r.enabled && r.scheduledAt <= now);
  }, [nowTick]);
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];

  // Mark new scheduled reminders as sent when they appear
  // (Scheduler is driven by App.tsx on mount + 5-min interval)

  useEffect(() => {
    if (!dueReminders) return;
    for (const r of dueReminders) {
      if (r.status === 'scheduled' && !markedRef.current.has(r.id)) {
        markedRef.current.add(r.id);
        markReminderSent(r.id).catch(console.error);
      }
    }
  }, [dueReminders]);

  // Hide tray when globally disabled or no due reminders
  if (!remindersEnabled || !dueReminders || dueReminders.length === 0) return null;

  const handleOpen = (r: Reminder) => {
    switch (r.type) {
      case 'task_due':
        navigate('/tasks');
        break;
      case 'habit_window':
        navigate('/habits');
        break;
      case 'calendar_block':
        navigate('/calendar');
        break;
      case 'daily_review':
        navigate('/review');
        break;
      case 'previous_review':
        navigate('/review');
        window.setTimeout(() => window.dispatchEvent(new Event('navigate_review_yesterday')), 0);
        break;
      case 'hydration':
      case 'movement':
        window.dispatchEvent(new Event('open_quick_log'));
        break;
      default:
        break;
    }
  };

  const canOpenReminder = (r: Reminder) => [
    'task_due',
    'habit_window',
    'calendar_block',
    'daily_review',
    'previous_review',
    'hydration',
    'movement',
  ].includes(r.type);

  const handleLogWater = async (r: Reminder) => {
    if (actionInFlightRef.current.has(r.id)) return;
    actionInFlightRef.current.add(r.id);
    try {
      const logged = await db.transaction('rw', db.activityLogs, db.reminders, async () => {
        const current = await db.reminders.get(r.id);
        if (!current || ['completed', 'dismissed', 'cancelled'].includes(current.status)) return false;
        const now = new Date().toISOString();
        await db.activityLogs.add({
          id: crypto.randomUUID(),
          type: 'water',
          label: 'Water (reminder)',
          quantity: 250,
          unit: 'ml',
          createdAt: now,
        } as never);
        await db.reminders.update(r.id, { status: 'completed', updatedAt: now } as never);
        return true;
      });
      if (logged) {
        window.dispatchEvent(new CustomEvent('show_toast', { detail: '250ml logged.' }));
        window.dispatchEvent(new Event('regenerate_now_what'));
      }
    } finally {
      actionInFlightRef.current.delete(r.id);
    }
  };

  const handleCompleteHabit = async (r: Reminder) => {
    if (!r.targetId || actionInFlightRef.current.has(r.id)) return;
    actionInFlightRef.current.add(r.id);
    try {
      const habit = await db.habits.get(r.targetId);
      if (!habit || habit.completionType !== 'boolean') return;
      await completeHabit(habit.id);
      await completeReminder(r.id);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: `${habit.name} marked complete.` }));
      window.dispatchEvent(new Event('regenerate_now_what'));
    } finally {
      actionInFlightRef.current.delete(r.id);
    }
  };

  const canCompleteHabit = (r: Reminder) =>
    r.type === 'habit_window' &&
    Boolean(r.targetId) &&
    habits.some(habit => habit.id === r.targetId && habit.completionType === 'boolean');

  return (
    <div className="reminder-tray" style={{
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 0',
      marginBottom: '16px',
    }}>
      <div
        className="mono"
        style={{
          fontSize: '10px',
          color: 'var(--dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '6px',
        }}
      >
        REMINDERS - {dueReminders.length}
      </div>

      {dueReminders.map(r => (
        <div
          key={r.id}
          className="reminder-tray-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--body)', lineHeight: 1.4 }}>
              {r.title}
            </div>
            {r.message && r.message !== 'Manual reminder.' && (
              <div style={{ fontSize: '10px', color: 'var(--secondary)', lineHeight: 1.4 }}>
                {r.message}
              </div>
            )}
          </div>

          <div className="reminder-tray-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {r.type === 'hydration' && (
              <button
                type="button"
                onClick={() => handleLogWater(r)}
                className="mono"
                style={actionBtn}
              >
                [LOG WATER]
              </button>
            )}
            {canCompleteHabit(r) && (
              <button
                type="button"
                onClick={() => handleCompleteHabit(r)}
                className="mono"
                style={actionBtn}
              >
                [COMPLETE]
              </button>
            )}
            {canOpenReminder(r) && (
              <button
                type="button"
                onClick={() => handleOpen(r)}
                aria-label={`Open reminder ${r.title}`}
                className="mono"
                style={actionBtn}
              >
                [OPEN]
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissReminder(r.id)}
              aria-label={`Dismiss reminder ${r.title}`}
              className="mono"
              style={dimBtn}
            >
              [x]
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--dim)',
  fontSize: '10px',
  padding: '2px 8px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const dimBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--dim)',
  fontSize: '10px',
  padding: '2px 6px',
  cursor: 'pointer',
};
