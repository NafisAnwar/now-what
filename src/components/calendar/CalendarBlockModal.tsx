import React, { useRef, useState } from 'react';
import { db } from '../../data/db';
import type { CalendarBlock } from '../../types';
import { getTodayStr, localDateFromTimestamp } from '../../utils/dateUtils';
import Modal from '../ui/Modal';
import {
  convertCalendarBlockToTask,
  createManualCalendarBlock,
  deleteCalendarBlock,
  updateCalendarBlock,
  validateManualCalendarBlockInput,
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const validate = (): boolean => {
    const error = validateManualCalendarBlockInput({ title, date, startTime, endTime });
    if (error) {
      setTimeError(error);
      return false;
    }
    setTimeError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      if (block) {
        const startAt = date + (startTime ? 'T' + startTime + ':00' : 'T00:00:00');
        const endAt = date + (endTime ? 'T' + endTime + ':00' : 'T23:59:00');
        const patch = {
          title: title.trim(),
          startAt,
          endAt,
          location: location.trim() || undefined,
          calendarName: calendarName.trim() || undefined,
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
    } catch (error) {
      console.error('[calendar] save failed:', error);
      setTimeError(error instanceof Error ? error.message : 'Calendar block could not be saved.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!block || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await deleteCalendarBlock(db, block.id);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Block deleted.' }));
      onClose();
    } catch (error) {
      console.error('[calendar] delete failed:', error);
      setTimeError('Calendar block could not be deleted.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleConvertToTask = async () => {
    if (!block || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await convertCalendarBlockToTask(db, block.id);
      window.dispatchEvent(new CustomEvent('show_toast', {
        detail: result.created ? 'Task created from calendar block.' : 'Task already created from calendar block.'
      }));
      window.dispatchEvent(new Event('regenerate_now_what'));
      onClose();
    } catch (error) {
      console.error('[calendar] task conversion failed:', error);
      setTimeError('Calendar block could not be converted.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const showConvert = !!block && (block.convertedTaskIds || []).length === 0;

  return (
    <Modal onClose={onClose} ariaLabel={block ? 'Edit calendar block' : 'New calendar block'}>
      <div
        style={{
          width: '100%',
        }}
      >
        <div style={{ marginBottom: '24px' }} className="mono label">
          {block ? 'EDIT BLOCK' : 'NEW BLOCK'}
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>TITLE</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            aria-label="Calendar block title"
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
            aria-label="Calendar block date"
            required
            style={inputStyle}
          />
        </div>

        <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '4px' }}>
          <div>
            <div className="label" style={{ marginBottom: '6px' }}>START TIME</div>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              aria-label="Calendar block start time"
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: '6px' }}>END TIME</div>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              aria-label="Calendar block end time"
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
            aria-label="Calendar block location"
            placeholder="optional"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>CALENDAR NAME</div>
          <input
            value={calendarName}
            onChange={e => setCalendarName(e.target.value)}
            aria-label="Calendar name"
            placeholder="optional"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim() || !date}
            className="mono"
            style={{
              background: 'var(--surface2)', color: 'var(--white)',
              border: '1px solid var(--border-hi)', padding: '8px 16px',
              fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
              type="button"
              onClick={handleDelete}
              disabled={saving}
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
              type="button"
              onClick={handleConvertToTask}
              disabled={saving}
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
    </Modal>
  );
}
