import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Reminder } from '../../types';
import ReminderRow from './ReminderRow';
import ReminderSettingsPanel from './ReminderSettingsPanel';
import { dismissReminder, completeReminder } from '../../data/reminders';

type Tab = 'SCHEDULED' | 'SENT' | 'DISMISSED' | 'SETTINGS';

export default function RemindersPage() {
  const [tab, setTab] = useState<Tab>('SCHEDULED');

  const allReminders = useLiveQuery(() => db.reminders.toArray() as Promise<Reminder[]>, []) ?? [];

  const scheduled = allReminders.filter(r => r.status === 'scheduled' || r.status === 'sent');
  const sent = allReminders.filter(r => r.status === 'sent');
  const dismissed = allReminders.filter(r => r.status === 'dismissed' || r.status === 'completed' || r.status === 'cancelled');

  const tabs: Tab[] = ['SCHEDULED', 'SENT', 'DISMISSED', 'SETTINGS'];

  const counts: Record<Tab, number | null> = {
    SCHEDULED: scheduled.length,
    SENT: sent.length,
    DISMISSED: dismissed.length,
    SETTINGS: null,
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="mono" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        REMINDERS
      </div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '20px' }}>
        Quiet, action-based reminders connected to your plan.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '20px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="mono"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t ? 'var(--primary)' : 'var(--dim)',
              fontSize: '11px',
              padding: '8px 14px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t}{counts[t] !== null && counts[t]! > 0 ? ` (${counts[t]})` : ''}
          </button>
        ))}
      </div>

      {tab === 'SCHEDULED' && (
        <div>
          {scheduled.length === 0 ? (
            <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>No pending reminders.</div>
          ) : (
            scheduled
              .slice()
              .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
              .map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  showActions
                  onDismiss={() => dismissReminder(r.id)}
                  onComplete={() => completeReminder(r.id)}
                />
              ))
          )}
        </div>
      )}

      {tab === 'SENT' && (
        <div>
          {sent.length === 0 ? (
            <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>No sent reminders.</div>
          ) : (
            sent
              .slice()
              .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
              .map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  showActions
                  onDismiss={() => dismissReminder(r.id)}
                  onComplete={() => completeReminder(r.id)}
                />
              ))
          )}
        </div>
      )}

      {tab === 'DISMISSED' && (
        <div>
          {dismissed.length === 0 ? (
            <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>No dismissed reminders.</div>
          ) : (
            dismissed
              .slice()
              .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
              .map(r => (
                <ReminderRow key={r.id} reminder={r} />
              ))
          )}
        </div>
      )}

      {tab === 'SETTINGS' && <ReminderSettingsPanel />}
    </div>
  );
}
