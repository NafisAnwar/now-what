import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { CalendarBlock } from '../../types';
import CalendarBlockRow from './CalendarBlockRow';
import CalendarBlockModal from './CalendarBlockModal';
import { CalendarImportError, importIcsFile } from '../../data/calendar';
import { getTodayStr, isLocalDate, localDateFromTimestamp, localDateStr } from '../../utils/dateUtils';

export default function CalendarPage() {
  const todayStr = getTodayStr();
  const allBlocks = useLiveQuery(() => db.calendarBlocks.orderBy('startAt').toArray(), []) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CalendarBlock | undefined>(undefined);
  const [icsError, setIcsError] = useState('');
  const [icsSuccess, setIcsSuccess] = useState('');
  const [showPast, setShowPast] = useState(false);

  const nowMs = Date.now();
  const in14Days = localDateStr(new Date(nowMs + 14 * 24 * 60 * 60 * 1000));

  const todayBlocks = allBlocks.filter(b => isLocalDate(b.startAt, todayStr));
  const upcomingBlocks = allBlocks.filter(b => {
    const blockDate = localDateFromTimestamp(b.startAt);
    return blockDate > todayStr && blockDate <= in14Days;
  });
  const pastBlocks = allBlocks.filter(b => localDateFromTimestamp(b.startAt) < todayStr);

  // Use Date.getTime() for numeric comparison — avoids timezone issues with ISO string comparison
  const isActive = (block: CalendarBlock) =>
    nowMs >= new Date(block.startAt).getTime() && nowMs <= new Date(block.endAt).getTime();

  const handleIcsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIcsError('');
    setIcsSuccess('');
    try {
      const result = await importIcsFile(db, file);
      setIcsSuccess(
        'Imported ' + result.imported + ' event(s).' +
        (result.skipped > 0 ? ' Skipped ' + result.skipped + ' duplicate(s).' : '') +
        (result.unsupportedRecurrenceCount > 0 ? ' Recurring events imported without expansion.' : '')
      );
    } catch (err) {
      setIcsError(err instanceof CalendarImportError ? err.message : 'Could not import calendar file.');
    }
    e.target.value = '';
  };

  const openEdit = (block: CalendarBlock) => {
    setEditingBlock(block);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingBlock(undefined);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingBlock(undefined);
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
    marginTop: '24px',
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 0 64px' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px',
      }}>
        <div className="mono label" style={{ fontSize: '14px' }}>CALENDAR</div>
        <button
          onClick={openNew}
          className="mono"
          style={{
            background: 'transparent', border: '1px solid var(--border-hi)',
            color: 'var(--dim)', fontSize: '11px', padding: '4px 10px',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          [+ ADD BLOCK]
        </button>
      </div>

      {/* TODAY */}
      <div style={sectionLabel}>TODAY</div>
      {todayBlocks.length === 0 ? (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
          no blocks for today
        </div>
      ) : (
        todayBlocks.map(block => (
          <CalendarBlockRow
            key={block.id}
            block={block}
            isActive={isActive(block)}
            onEdit={() => openEdit(block)}
          />
        ))
      )}

      {/* UPCOMING (up to 14 days) */}
      <div style={sectionLabel}>UPCOMING (14 DAYS)</div>
      {upcomingBlocks.length === 0 ? (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
          no upcoming blocks
        </div>
      ) : (
        upcomingBlocks.map(block => (
          <CalendarBlockRow
            key={block.id}
            block={block}
            isActive={false}
            onEdit={() => openEdit(block)}
          />
        ))
      )}

      {/* PAST (collapsed) */}
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>PAST</span>
        <button
          onClick={() => setShowPast(p => !p)}
          className="mono"
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--dim)', fontSize: '10px',
            cursor: 'pointer', padding: 0,
          }}
        >
          {showPast ? '[HIDE]' : `[SHOW PAST (${pastBlocks.length})]`}
        </button>
      </div>
      {showPast && (
        pastBlocks.length === 0 ? (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
            no past blocks
          </div>
        ) : (
          pastBlocks.map(block => (
            <CalendarBlockRow
              key={block.id}
              block={block}
              isActive={false}
              onEdit={() => openEdit(block)}
            />
          ))
        )
      )}

      {/* ICS IMPORT */}
      <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <div className="label" style={{ marginBottom: '8px' }}>IMPORT .ICS FILE</div>
        <input
          type="file"
          accept=".ics"
          onChange={handleIcsImport}
          style={{ color: 'var(--dim)', fontFamily: 'var(--mono)', fontSize: '12px' }}
        />
        {icsError && (
          <div className="mono" style={{ color: 'var(--error)', fontSize: '11px', marginTop: '8px' }}>
            {icsError}
          </div>
        )}
        {icsSuccess && (
          <div className="mono" style={{ color: 'var(--dim)', fontSize: '11px', marginTop: '8px' }}>
            {icsSuccess}
          </div>
        )}
      </div>

      {/* Future integrations placeholder */}
      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>Google Calendar — connect later</div>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '6px' }}>Apple Calendar — connect later</div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CalendarBlockModal block={editingBlock} onClose={handleClose} />
      )}
    </div>
  );
}
