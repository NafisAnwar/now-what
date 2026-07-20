import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { getCalendarBlocksForDate, isAllDayCalendarBlock } from '../../data/calendar';
import { useTodayStr } from '../../utils/dateUtils';

export default function CalendarStrip() {
  const todayStr = useTodayStr();
  const todaysBlocks = useLiveQuery(
    () => getCalendarBlocksForDate(db, todayStr),
    [todayStr]
  ) || [];

  const nowMs = Date.now();
  const sorted = todaysBlocks;

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
          const active = nowMs >= new Date(block.startAt).getTime() && nowMs < new Date(block.endAt).getTime();
          const range = isAllDayCalendarBlock(block)
            ? 'ALL DAY'
            : `${fmt(block.startAt)}-${fmt(block.endAt)}`;
          return (
            <div key={block.id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
              {range}&nbsp;&nbsp;{block.title}{active ? '  [NOW]' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
