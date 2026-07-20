import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { isLocalDate, useTodayStr } from '../../utils/dateUtils';

export default function ActivityFeed() {
  const todayStr = useTodayStr();
  
  // toArray() + JS sort gives correct descending order; Dexie's .reverse().sortBy()
  // always returns ascending regardless of .reverse() direction.
  const logs = useLiveQuery(async () => {
    const all = await db.activityLogs.filter(log => isLocalDate(log.createdAt, todayStr)).toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [todayStr]);

  if (!logs) return null;

  const displayLogs = logs.slice(0, 8);

  return (
    <div>
      <div className="label" style={{ marginBottom: '16px' }}>ACTIVITY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displayLogs.map(log => {
          const time = new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          let suffix = '';
          if (log.durationMinutes) suffix = `${log.durationMinutes}m`;
          else if (log.quantity && log.unit) suffix = `${log.quantity} ${log.unit}`;
          else if (log.quantity) suffix = `${log.quantity}`;

          return (
            <div key={log.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <span className="mono" style={{ color: 'var(--dim)', fontSize: '12px', flexShrink: 0 }}>
                {time}
              </span>
              <span className="mono" style={{ color: 'var(--dim)', fontSize: '10px', textTransform: 'uppercase', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 0, lineHeight: 1 }}>
                {log.type.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--body)', fontSize: '14px', flex: 1, wordBreak: 'break-word' }}>
                {log.label}
              </span>
              {suffix && (
                <span className="mono" style={{ color: 'var(--dim)', fontSize: '12px', flexShrink: 0 }}>
                  {suffix}
                </span>
              )}
            </div>
          );
        })}
        {displayLogs.length === 0 && (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>No activity logged.</div>
        )}
      </div>
    </div>
  );
}
