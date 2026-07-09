import React from 'react';
import type { Reminder } from '../../types';

interface Props {
  reminder: Reminder;
  showActions?: boolean;
  onDismiss?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  task_due: 'TASK',
  habit_window: 'HABIT',
  calendar_block: 'CALENDAR',
  planned_focus: 'FOCUS',
  daily_review: 'REVIEW',
  previous_review: 'REVIEW',
  hydration: 'HYDRATION',
  movement: 'MOVEMENT',
  manual: 'MANUAL',
  custom: 'CUSTOM',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'PENDING',
  sent: 'SENT',
  dismissed: 'DISMISSED',
  completed: 'DONE',
  cancelled: 'CANCELLED',
};

export default function ReminderRow({ reminder, showActions, onDismiss, onComplete, onCancel }: Props) {
  const typeLabel = TYPE_LABELS[reminder.type] ?? reminder.type.toUpperCase();
  const statusLabel = STATUS_LABELS[reminder.status] ?? reminder.status.toUpperCase();
  const scheduled = new Date(reminder.scheduledAt);
  const date = scheduled.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const showMessage = reminder.message && reminder.message !== 'Manual reminder.';

  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          className="mono"
          style={{
            fontSize: '9px',
            border: '1px solid var(--border)',
            padding: '1px 4px',
            color: 'var(--dim)',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {typeLabel}
        </span>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--body)', flex: 1, minWidth: 0 }}>
          {reminder.title}
        </span>
        <span className="mono" style={{ fontSize: '9px', color: 'var(--dim)', flexShrink: 0 }}>
          {date} {time}
        </span>
        <span className="mono" style={{ fontSize: '9px', color: 'var(--dim)', flexShrink: 0, minWidth: '60px', textAlign: 'right' }}>
          {statusLabel}
        </span>
      </div>

      {showMessage && (
        <div style={{ fontSize: '11px', color: 'var(--secondary)', lineHeight: 1.5, paddingLeft: '0' }}>
          {reminder.message}
        </div>
      )}

      {showActions && (onDismiss || onComplete || onCancel) && (
        <div style={{ display: 'flex', gap: '8px', marginLeft: '0' }}>
          {onComplete && (
            <button
              onClick={onComplete}
              className="mono"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: '10px', padding: '2px 8px',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              [DONE]
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="mono"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: '10px', padding: '2px 8px',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              [DISMISS]
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="mono"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: '10px', padding: '2px 8px',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              [CANCEL]
            </button>
          )}
        </div>
      )}
    </div>
  );
}
