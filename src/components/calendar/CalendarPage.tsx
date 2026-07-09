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

  const todayBlocks = allBlocks.filter(block => isLocalDate(block.startAt, todayStr));
  const upcomingBlocks = allBlocks.filter(block => {
    const blockDate = localDateFromTimestamp(block.startAt);
    return blockDate > todayStr && blockDate <= in14Days;
  });
  const pastBlocks = allBlocks.filter(block => localDateFromTimestamp(block.startAt) < todayStr);

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

  const sectionStyle: React.CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: '18px 0 22px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  const emptyStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--dim)',
    padding: '2px 0',
  };

  const renderBlocks = (blocks: CalendarBlock[]) => (
    <div>
      {blocks.map(block => (
        <CalendarBlockRow
          key={block.id}
          block={block}
          isActive={isActive(block)}
          onEdit={() => openEdit(block)}
        />
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 0 64px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        paddingBottom: '16px',
      }}>
        <div className="mono label" style={{ fontSize: '14px' }}>CALENDAR</div>
        <button
          onClick={openNew}
          className="mono"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-hi)',
            color: 'var(--dim)',
            fontSize: '11px',
            padding: '4px 10px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          [+ ADD BLOCK]
        </button>
      </div>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionLabel}>TODAY</div>
        </div>
        {todayBlocks.length === 0 ? (
          <div className="mono" style={emptyStyle}>no blocks for today</div>
        ) : renderBlocks(todayBlocks)}
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionLabel}>UPCOMING</div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>14 DAYS</div>
        </div>
        {upcomingBlocks.length === 0 ? (
          <div className="mono" style={emptyStyle}>no upcoming blocks</div>
        ) : renderBlocks(upcomingBlocks)}
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionLabel}>PAST</div>
          {pastBlocks.length > 0 && (
            <button
              onClick={() => setShowPast(prev => !prev)}
              className="mono"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--dim)',
                fontSize: '10px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showPast ? '[HIDE]' : `[SHOW PAST (${pastBlocks.length})]`}
            </button>
          )}
        </div>
        {pastBlocks.length === 0 ? (
          <div className="mono" style={emptyStyle}>no past blocks</div>
        ) : showPast ? renderBlocks(pastBlocks) : null}
      </section>

      <section style={sectionStyle}>
        <div className="label" style={{ marginBottom: '10px' }}>IMPORT .ICS FILE</div>
        <input
          id="calendar-ics-import"
          type="file"
          accept=".ics"
          onChange={handleIcsImport}
          className="visually-hidden-file"
        />
        <label htmlFor="calendar-ics-import" className="mono file-trigger">
          [SELECT .ICS FILE]
        </label>
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
      </section>

      <section style={sectionStyle}>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>Google Calendar - connect later</div>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '6px' }}>Apple Calendar - connect later</div>
      </section>

      {isModalOpen && (
        <CalendarBlockModal block={editingBlock} onClose={handleClose} />
      )}
    </div>
  );
}
