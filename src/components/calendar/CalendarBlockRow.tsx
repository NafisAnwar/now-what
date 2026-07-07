import React from 'react';
import type { CalendarBlock } from '../../types';

interface Props {
  block: CalendarBlock;
  isActive: boolean;
  onEdit: () => void;
}

export default function CalendarBlockRow({ block, isActive, onEdit }: Props) {
  const fmt = (iso: string) => iso.includes('T') ? iso.split('T')[1].slice(0, 5) : '—';

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Time range */}
      <span className="mono" style={{ fontSize: '11px', color: 'var(--dim)', flexShrink: 0, minWidth: '90px' }}>
        {fmt(block.startAt)} – {fmt(block.endAt)}
      </span>

      {/* Title + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '14px', color: 'var(--body)' }}>{block.title}</span>
        {isActive && (
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginLeft: '8px' }}>
            [NOW]
          </span>
        )}
        {block.location && (
          <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '2px' }}>
            {block.location}
          </div>
        )}
        {(block.convertedTaskIds || []).length > 0 && (
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginLeft: '8px' }}>
            [TASK CREATED]
          </span>
        )}
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="mono"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--dim)',
          fontSize: '11px',
          cursor: 'pointer',
          padding: '0 4px',
          flexShrink: 0,
          textTransform: 'uppercase',
        }}
      >
        [EDIT]
      </button>
    </div>
  );
}
