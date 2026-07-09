import React, { useState, useEffect } from 'react';
import { db } from '../../data/db';
import type { CalendarBlock } from '../../types';
import { getTodayStr, localDateFromTimestamp } from '../../utils/dateUtils';
import {
  convertCalendarBlockToTask,
  createManualCalendarBlock,
  deleteCalendarBlock,
  updateCalendarBlock,
} from '../../data/calendar';

interface Props {
  block?: CalendarBlock;
  onClose: () => void;
  onSaved?: (block: CalendarBlock) => void | Promise<void>;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border-hi)',
  color: 'var(--primary)', padding: '8px 12px', fontFamily: 'var(--mono)',
  width: '100%', fontSize: '13px', borderRadius: 0, outline: 'none', marginBottom: '16px',
  boxSizing: 'border-box',
};

export default function CalendarBlockModal({ block, onClose, onSaved }: Props) {
  const todayStr = getTodayStr();

  const [title, setTitle] = useState(block?.title || '');
  const [date, setDate] = useState(block?.startAt ? localDateFromTimestamp(block.startAt) : todayStr);
  const [startTime, setStartTime] = useState(
    block?.startAt?.includes('T') ? block.startAt.split('T')[1].slice(0, 5) : ''
  );
  const [endTime, setEndTime] = useState(
    block?.endAt?.includes('T') ? block.endAt.split('T')[1].slice(0, 5) : ''
  );
  const [location, setLocation] = useState(block?.location || '');
  const [calendarName, setCalendarName] = useState(block?.calendarName || '');
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validate = (): boolean => {
    if (!title.trim()) return false;
    if (startTime && endTime && endTime <= startTime) {
      setTimeError('End time must be after start time.');
      return false;
    }
    setTimeError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    if (block) {
      const startAt = date + (startTime ? 'T' + startTime + ':00' : 'T00:00:00');
      const endAt = date + (endTime ? 'T' + endTime + ':00' : 'T23:59:00');
      const patch = {
        title,
        startAt,
        endAt,
        location: location || undefined,
        calendarName: calendarName || undefined,
      };
      await updateCalendarBlock(db, block.id, patch);
      await onSaved?.({ ...block, ...patch, updatedAt: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Block updated.' }));
    } else {
      const createdBlock = await createManualCalendarBlock(db, {
        title,
        date,
        startTime,
        endTime,
        location: location || undefined,
        calendarName: calendarName || undefined,
      });
      await onSaved?.(createdBlock);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Block added.' }));
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!block) return;
    await deleteCalendarBlock(db, block.id);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Block deleted.' }));
    onClose();
  };

  const handleConvertToTask = async () => {
    if (!block) return;
    const result = await convertCalendarBlockToTask(db, block.id);
    window.dispatchEvent(new CustomEvent('show_toast', {
      detail: result.created ? 'Task created from calendar block.' : 'Task already created from calendar block.'
    }));
    window.dispatchEvent(new Event('regenerate_now_what'));
    onClose();
  };

  const showConvert = !!block && (block.convertedTaskIds || []).length === 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--surface)', border: '1px solid var(--border-hi)',
          padding: '32px', width: '480px', maxWidth: 'calc(100vw - 48px)',
          maxHeight: '80vh', overflowY: 'auto', zIndex: 101,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }} className="mono label">
          {block ? 'EDIT BLOCK' : 'NEW BLOCK'}
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>TITLE</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            style={inputStyle}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>DATE</div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '4px' }}>
          <div>
            <div className="label" style={{ marginBottom: '6px' }}>START TIME</div>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: '6px' }}>END TIME</div>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
        </div>

        {timeError && (
          <div className="mono" style={{ color: 'var(--error)', fontSize: '11px', marginBottom: '12px', marginTop: '4px' }}>
            {timeError}
          </div>
        )}

        <div style={{ marginBottom: '4px', marginTop: timeError ? 0 : '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>LOCATION</div>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="optional"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>CALENDAR NAME</div>
          <input
            value={calendarName}
            onChange={e => setCalendarName(e.target.value)}
            placeholder="optional"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            className="mono"
            style={{
              background: 'var(--surface2)', color: 'var(--white)',
              border: '1px solid var(--border-hi)', padding: '8px 16px',
              fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            SAVE
          </button>
          <button
            onClick={onClose}
            className="mono"
            style={{
              background: 'transparent', color: 'var(--dim)',
              border: '1px solid var(--border-hi)', padding: '8px 16px',
              fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
          {block && (
            <button
              onClick={handleDelete}
              className="mono"
              style={{
                background: 'transparent', color: 'var(--error)',
                border: '1px solid var(--border-hi)', padding: '8px 16px',
                fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              DELETE
            </button>
          )}
          {showConvert && (
            <button
              onClick={handleConvertToTask}
              className="mono"
              style={{
                background: 'transparent', color: 'var(--dim)',
                border: '1px solid var(--border)', padding: '8px 16px',
                fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              CONVERT TO TASK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
