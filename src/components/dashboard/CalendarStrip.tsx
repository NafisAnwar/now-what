import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { getTodayStr } from '../../utils/dateUtils';

export default function CalendarStrip() {
  const todayStr = getTodayStr();
  const todaysBlocks = useLiveQuery(
    () => db.calendarBlocks.filter(b => b.startAt.startsWith(todayStr)).toArray(),
    [todayStr]
  ) || [];

  const nowIso = new Date().toISOString();
  const sorted = [...todaysBlocks].sort((a, b) => a.startAt.localeCompare(b.startAt));

  if (sorted.length === 0) return null;

  const fmt = (iso: string) => iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso;

  return (
    <div style={{
      marginBottom: '32px',
      borderTop: '1px solid var(--border)',
      paddingTop: '16px',
    }}>
      <div className="mono" style={{
        fontSize: '10px',
        color: 'var(--dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '8px',
      }}>
        TODAY'S BLOCKS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sorted.map(block => {
          const active = nowIso >= block.startAt && nowIso <= block.endAt;
          return (
            <div key={block.id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
              {fmt(block.startAt)}–{fmt(block.endAt)}&nbsp;&nbsp;{block.title}{active ? '  [NOW]' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
