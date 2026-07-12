import React, { useEffect, useState } from 'react';
import { getReminderSettings, updateReminderSettings, REMINDER_DEFAULTS } from '../../data/reminders';
import type { ReminderSettings } from '../../data/reminders';

export default function ReminderSettingsPanel() {
  const [settings, setSettings] = useState<ReminderSettings>(REMINDER_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    getReminderSettings().then(s => {
      setSettings(s);
      setLoaded(true);
      // Sync browser permission state
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted' && s.browserNotificationsEnabled) {
          setNotifStatus('granted');
        } else if (Notification.permission === 'denied') {
          setNotifStatus('denied');
        }
      }
    });
  }, []);

  const toggle = async (key: keyof ReminderSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await updateReminderSettings({ [key]: !settings[key] });
  };

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotifStatus('denied');
      return;
    }
    setNotifStatus('requesting');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotifStatus('granted');
      await updateReminderSettings({ browserNotificationsEnabled: true });
      setSettings(prev => ({ ...prev, browserNotificationsEnabled: true }));
    } else {
      setNotifStatus('denied');
      await updateReminderSettings({ browserNotificationsEnabled: false });
      setSettings(prev => ({ ...prev, browserNotificationsEnabled: false }));
    }
  };

  const handleQuietHours = async (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await updateReminderSettings({ [key]: value });
  };

  if (!loaded) return null;

  return (
    <div>
      <div style={sectionLabel}>GENERAL</div>
      <ToggleRow
        label="In-app reminders"
        active={settings.remindersEnabled}
        onToggle={() => toggle('remindersEnabled')}
      />

      <div style={sectionLabel}>BROWSER NOTIFICATIONS</div>
      {notifStatus === 'granted' ? (
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', padding: '6px 0' }}>
          Browser notifications enabled.
        </div>
      ) : notifStatus === 'denied' ? (
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', padding: '6px 0' }}>
          Browser notifications not enabled.
        </div>
      ) : (
        <button
          onClick={handleRequestNotifications}
          disabled={notifStatus === 'requesting'}
          className="mono"
          style={{
            background: 'var(--surface2)', border: '1px solid var(--border-hi)',
            color: 'var(--white)', fontSize: '11px', padding: '5px 12px',
            cursor: notifStatus === 'requesting' ? 'default' : 'pointer',
            textTransform: 'uppercase', marginBottom: '8px',
            opacity: notifStatus === 'requesting' ? 0.6 : 1,
          }}
        >
          {notifStatus === 'requesting' ? 'REQUESTING...' : '[ENABLE BROWSER NOTIFICATIONS]'}
        </button>
      )}

      <div style={sectionLabel}>REMINDER TYPES</div>
      <ToggleRow
        label="Task due reminders"
        active={settings.taskDueRemindersEnabled}
        onToggle={() => toggle('taskDueRemindersEnabled')}
      />
      <ToggleRow
        label="Habit window reminders"
        active={settings.habitWindowRemindersEnabled}
        onToggle={() => toggle('habitWindowRemindersEnabled')}
      />
      <ToggleRow
        label="Calendar block reminders"
        active={settings.calendarRemindersEnabled}
        onToggle={() => toggle('calendarRemindersEnabled')}
      />
      <ToggleRow
        label="Daily review reminder"
        active={settings.reviewReminderEnabled}
        onToggle={() => toggle('reviewReminderEnabled')}
      />
      <ToggleRow
        label="Hydration reminder"
        active={settings.hydrationRemindersEnabled}
        onToggle={() => toggle('hydrationRemindersEnabled')}
      />
      <ToggleRow
        label="Movement reminder"
        active={settings.movementRemindersEnabled}
        onToggle={() => toggle('movementRemindersEnabled')}
      />

      <div style={sectionLabel}>QUIET HOURS</div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px', lineHeight: 1.5 }}>
        Non-critical reminders are suppressed during quiet hours.
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase' }}>START</span>
          <input
            type="time"
            value={settings.quietHoursStart}
            onChange={e => handleQuietHours('quietHoursStart', e.target.value)}
            className="mono"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--body)', fontSize: '12px', padding: '4px 8px',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase' }}>END</span>
          <input
            type="time"
            value={settings.quietHoursEnd}
            onChange={e => handleQuietHours('quietHoursEnd', e.target.value)}
            className="mono"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--body)', fontSize: '12px', padding: '4px 8px',
            }}
          />
        </label>
      </div>
    </div>
  );
}

function ToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0', borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="mono" style={{ fontSize: '11px', color: 'var(--body)' }}>{label}</span>
      <button
        onClick={onToggle}
        className="mono"
        style={{
          background: 'transparent',
          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          color: active ? 'var(--primary)' : 'var(--dim)',
          fontSize: '10px', padding: '2px 8px',
          cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        {active ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: 'var(--dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginTop: '16px',
  marginBottom: '8px',
};
