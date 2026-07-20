import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { ActivityLog } from '../../types';
import { isLocalDate, useTodayStr } from '../../utils/dateUtils';

export default function Timeline() {
  const todayStr = useTodayStr();

  // toArray() + JS sort gives correct descending order; Dexie's .reverse().sortBy()
  // always returns ascending regardless of .reverse() direction.
  const logs = useLiveQuery(async () => {
    const all = await db.activityLogs.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  const habits = useLiveQuery(() => db.habits.toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  if (!logs) return null;

  const displayLogs = logs.slice(0, 100);
  
  const todayLogs = displayLogs.filter(log => isLocalDate(log.createdAt, todayStr));
  const earlierLogs = displayLogs.filter(log => !isLocalDate(log.createdAt, todayStr));

  const renderLog = (log: ActivityLog) => {
    const time = new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    let suffix = '';
    if (log.durationMinutes) suffix = `${log.durationMinutes}m`;
    else if (log.quantity && log.unit) suffix = `${log.quantity} ${log.unit}`;
    else if (log.quantity) suffix = `${log.quantity}`;

    let relatedText = '';
    if (log.relatedTaskId && tasks) {
      const t = tasks.find(x => x.id === log.relatedTaskId);
      if (t) relatedText = `→ Task: ${t.title}`;
    } else if (log.relatedHabitId && habits) {
      const h = habits.find(x => x.id === log.relatedHabitId);
      if (h) relatedText = `→ Habit: ${h.name}`;
    }

    return (
      <div key={log.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <span className="mono" style={{ color: 'var(--dim)', fontSize: '12px', flexShrink: 0, marginTop: '2px' }}>
          {time}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mono" style={{ color: 'var(--dim)', fontSize: '10px', textTransform: 'uppercase', padding: '2px 4px', border: '1px solid var(--border)' }}>
              {log.type.replace('_', ' ')}
            </span>
            <span style={{ color: 'var(--body)', fontSize: '14px' }}>
              {log.label}
            </span>
          </div>
          {(suffix || relatedText || log.notes) && (
            <div className="mono" style={{ color: 'var(--dim)', fontSize: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              {suffix && <span>{suffix}</span>}
              {relatedText && <span>{relatedText}</span>}
              {log.notes && <span style={{ color: 'var(--dim)' }}>{log.notes}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '640px', margin: '0 auto' }}>
      <div className="mono label" style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--primary)' }}>
        TIMELINE <span style={{ color: 'var(--dim)' }}>— {todayStr}</span>
      </div>
      
      {todayLogs.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="label" style={{ marginBottom: '16px', color: 'var(--dim)' }}>TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {todayLogs.map(renderLog)}
          </div>
        </div>
      )}

      {earlierLogs.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: '16px', color: 'var(--dim)' }}>EARLIER</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {earlierLogs.map(renderLog)}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="mono" style={{ color: 'var(--dim)' }}>No activity logs yet.</div>
      )}
    </div>
  );
}
