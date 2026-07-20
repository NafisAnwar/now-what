import React, { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Reminder } from '../../types';
import ReminderRow from './ReminderRow';
import ReminderSettingsPanel from './ReminderSettingsPanel';
import {
  cancelReminder,
  completeReminder,
  createManualReminder,
  dismissReminder,
  getDefaultManualReminderDateTime,
} from '../../data/reminders';
import { useTodayStr } from '../../utils/dateUtils';

type Tab = 'SCHEDULED' | 'SENT' | 'DISMISSED' | 'SETTINGS';

export default function RemindersPage() {
  const todayStr = useTodayStr();
  const [tab, setTab] = useState<Tab>('SCHEDULED');
  const [showForm, setShowForm] = useState(false);
  const [initialReminderDefaults] = useState(getDefaultManualReminderDateTime);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialReminderDefaults.date);
  const [time, setTime] = useState(initialReminderDefaults.time);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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

  const resetForm = () => {
    const defaults = getDefaultManualReminderDateTime();
    setTitle('');
    setDate(defaults.date);
    setTime(defaults.time);
    setNote('');
    setFormError('');
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      await createManualReminder({ title, date, time, note });
      resetForm();
      setShowForm(false);
      setTab('SCHEDULED');
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Reminder added.' }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add reminder.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="mono" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        REMINDERS
      </div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '20px' }}>
        Quiet, action-based reminders connected to your plan.
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => {
            setShowForm(prev => !prev);
            setFormError('');
          }}
          className="mono"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-hi)',
            color: 'var(--body)',
            padding: '7px 12px',
            fontSize: '11px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {showForm ? '[CLOSE]' : '[+ ADD REMINDER]'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateReminder}
          style={{
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 0',
            marginBottom: '20px',
          }}
        >
          <div className="mono label" style={{ marginBottom: '12px' }}>NEW REMINDER</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            <label>
              <span className="label" style={{ display: 'block', marginBottom: '6px' }}>TITLE</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={formInputStyle}
                required
                autoFocus
              />
            </label>
            <label>
              <span className="label" style={{ display: 'block', marginBottom: '6px' }}>DATE</span>
              <input
                type="date"
                min={todayStr}
                value={date}
                onChange={e => setDate(e.target.value)}
                style={formInputStyle}
                required
              />
            </label>
            <label>
              <span className="label" style={{ display: 'block', marginBottom: '6px' }}>TIME</span>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={formInputStyle}
                required
              />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '12px' }}>
            <span className="label" style={{ display: 'block', marginBottom: '6px' }}>NOTE</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ ...formInputStyle, minHeight: '64px', resize: 'vertical' }}
            />
          </label>
          {formError && (
            <div className="mono" style={{ color: 'var(--error)', fontSize: '11px', marginTop: '8px' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              disabled={saving}
              className="mono"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-hi)',
                color: 'var(--dim)',
                padding: '7px 12px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              [CANCEL]
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !date || !time}
              className="mono"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border-hi)',
                color: 'var(--white)',
                padding: '7px 12px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {saving ? '[SAVING...]' : '[SAVE]'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Reminder views" style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '20px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
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
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
              .map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  showActions
                  onDismiss={() => dismissReminder(r.id)}
                  onComplete={() => completeReminder(r.id)}
                  onCancel={() => cancelReminder(r.id)}
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
                  onCancel={() => cancelReminder(r.id)}
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

const formInputStyle: React.CSSProperties = {
  background: 'var(--surface2)',
  color: 'var(--primary)',
  border: '1px solid var(--border-hi)',
  padding: '8px 12px',
  fontFamily: 'var(--mono)',
  width: '100%',
  fontSize: '13px',
  borderRadius: 0,
  outline: 'none',
};
