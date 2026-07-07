import React, { useEffect, useRef } from 'react';
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
import { getTodayStr } from '../../utils/dateUtils';

export default function InAppReminderTray() {
  const [, navigate] = useLocation();
  const markedRef = useRef<Set<string>>(new Set());

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
  }, []);

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
        window.dispatchEvent(new CustomEvent('navigate_review_yesterday'));
        navigate('/review');
        break;
      case 'hydration':
      case 'movement':
        window.dispatchEvent(new Event('open_quick_log'));
        break;
      default:
        break;
    }
  };

  const handleLogWater = async (r: Reminder) => {
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'water',
      label: 'Water (reminder)',
      quantity: 250,
      unit: 'ml',
      createdAt: new Date().toISOString(),
    } as never);
    await completeReminder(r.id);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: '250ml logged.' }));
    window.dispatchEvent(new Event('regenerate_now_what'));
  };

  const handleCompleteHabit = async (r: Reminder) => {
    if (!r.targetId) return;
    const habit = await db.habits.get(r.targetId);
    if (!habit) return;
    const todayStr = getTodayStr();
    if (!habit.completionHistory.some((c: { date: string }) => c.date === todayStr)) {
      const now = new Date().toISOString();
      await db.habits.update(r.targetId, {
        completionHistory: [...habit.completionHistory, { date: todayStr, value: 1, completedAt: now }],
        updatedAt: now,
      });
      await db.activityLogs.add({
        id: crypto.randomUUID(),
        type: 'habit_completed',
        label: `Habit: ${habit.name}`,
        relatedHabitId: habit.id,
        createdAt: now,
      } as never);
    }
    await completeReminder(r.id);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: `${habit.name} marked complete.` }));
    window.dispatchEvent(new Event('regenerate_now_what'));
  };

  return (
    <div style={{
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
        REMINDERS — {dueReminders.length}
      </div>

      {dueReminders.map(r => (
        <div
          key={r.id}
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
          </div>

          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {r.type === 'hydration' && (
              <button
                onClick={() => handleLogWater(r)}
                className="mono"
                style={actionBtn}
              >
                [LOG WATER]
              </button>
            )}
            {r.type === 'habit_window' && r.targetId && (
              <button
                onClick={() => handleCompleteHabit(r)}
                className="mono"
                style={actionBtn}
              >
                [COMPLETE]
              </button>
            )}
            <button
              onClick={() => handleOpen(r)}
              className="mono"
              style={actionBtn}
            >
              [OPEN]
            </button>
            <button
              onClick={() => dismissReminder(r.id)}
              className="mono"
              style={dimBtn}
            >
              [×]
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
