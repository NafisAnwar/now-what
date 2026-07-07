import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { getSettingsInfo } from '../../data/exportImport';
import { useState, useEffect } from 'react';
import type { Settings } from '../../types';

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '4px 0',
  borderBottom: '1px solid var(--border)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--dim)',
  fontFamily: 'var(--mono)',
};

const valueStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--body)',
  fontFamily: 'var(--mono)',
};

export default function SchemaPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettingsInfo().then(setSettings);
  }, []);

  const taskCount     = useLiveQuery(() => db.tasks.count(), []) ?? '—';
  const habitCount    = useLiveQuery(() => db.habits.count(), []) ?? '—';
  const goalCount     = useLiveQuery(() => db.goals.count(), []) ?? '—';
  const blockCount    = useLiveQuery(() => db.calendarBlocks.count(), []) ?? '—';
  const logCount      = useLiveQuery(() => db.activityLogs.count(), []) ?? '—';
  const planCount     = useLiveQuery(() => db.dailyPlans.count(), []) ?? '—';
  const suggCount     = useLiveQuery(() => db.suggestions.count(), []) ?? '—';
  const reviewCount   = useLiveQuery(() => db.dailyReviews.count(), []) ?? '—';
  const weeklyCount   = useLiveQuery(() => db.weeklyReviews.count(), []) ?? '—';
  const settingsCount   = useLiveQuery(() => db.settings.count(), []) ?? '—';
  const reminderCount   = useLiveQuery(() => db.reminders.count(), []) ?? '—';

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
    marginTop: '20px',
  };

  return (
    <div>
      <div style={sectionLabel}>SYSTEM</div>
      <div style={row}><span style={labelStyle}>App</span><span style={valueStyle}>NOW_WHAT?</span></div>
      <div style={row}><span style={labelStyle}>Version</span><span style={valueStyle}>v0.9.0</span></div>
      <div style={row}><span style={labelStyle}>Database</span><span style={valueStyle}>nowwhat_db</span></div>
      <div style={row}><span style={labelStyle}>Schema version</span><span style={valueStyle}>2</span></div>
      <div style={row}><span style={labelStyle}>Storage</span><span style={valueStyle}>IndexedDB (local)</span></div>
      <div style={row}><span style={labelStyle}>Stores</span><span style={valueStyle}>11</span></div>

      <div style={sectionLabel}>RECORD COUNTS</div>
      <div style={row}><span style={labelStyle}>Tasks</span><span style={valueStyle}>{taskCount}</span></div>
      <div style={row}><span style={labelStyle}>Habits</span><span style={valueStyle}>{habitCount}</span></div>
      <div style={row}><span style={labelStyle}>Goals</span><span style={valueStyle}>{goalCount}</span></div>
      <div style={row}><span style={labelStyle}>Calendar Blocks</span><span style={valueStyle}>{blockCount}</span></div>
      <div style={row}><span style={labelStyle}>Activity Logs</span><span style={valueStyle}>{logCount}</span></div>
      <div style={row}><span style={labelStyle}>Daily Plans</span><span style={valueStyle}>{planCount}</span></div>
      <div style={row}><span style={labelStyle}>Suggestions</span><span style={valueStyle}>{suggCount}</span></div>
      <div style={row}><span style={labelStyle}>Daily Reviews</span><span style={valueStyle}>{reviewCount}</span></div>
      <div style={row}><span style={labelStyle}>Weekly Reviews</span><span style={valueStyle}>{weeklyCount}</span></div>
      <div style={row}><span style={labelStyle}>Settings</span><span style={valueStyle}>{settingsCount}</span></div>
      <div style={row}><span style={labelStyle}>Reminders</span><span style={valueStyle}>{reminderCount}</span></div>

      <div style={sectionLabel}>EXPORT / IMPORT</div>
      <div style={row}>
        <span style={labelStyle}>Last export</span>
        <span style={valueStyle}>{settings?.lastExportAt ? new Date(settings.lastExportAt).toLocaleString() : '—'}</span>
      </div>
      <div style={row}>
        <span style={labelStyle}>Last import</span>
        <span style={valueStyle}>{settings?.lastImportAt ? new Date(settings.lastImportAt).toLocaleString() : '—'}</span>
      </div>

      <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '20px', lineHeight: 1.6 }}>
        Dates use this browser's local timezone. Cloud sync is not enabled.
      </div>
    </div>
  );
}
