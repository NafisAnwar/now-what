import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Habit } from '../../types';
import {
  CUSTOM_CATEGORY_OPTION,
  HABIT_CATEGORY_OPTIONS,
  isCategoryOption,
} from '../../constants/categories';

interface Props {
  habit?: Habit;
  onClose: () => void;
  onSaved?: (habit: Habit) => void | Promise<void>;
}

export default function HabitModal({ habit, onClose, onSaved }: Props) {
  const initialCategory = habit?.category || 'Health';
  const [name, setName] = useState(habit?.name || '');
  const [categorySelection, setCategorySelection] = useState(
    isCategoryOption(initialCategory, HABIT_CATEGORY_OPTIONS)
      ? initialCategory
      : CUSTOM_CATEGORY_OPTION
  );
  const [customCategory, setCustomCategory] = useState(
    isCategoryOption(initialCategory, HABIT_CATEGORY_OPTIONS) ? '' : initialCategory
  );
  const [goalId, setGoalId] = useState(habit?.goalId || '');
  const activeGoals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []) || [];
  const goalOptions = Array.from(new Map(activeGoals.map(goal => [goal.id, goal])).values());
  const [frequency, setFrequency] = useState<'daily'|'weekly'|'custom'>(habit?.frequency || 'daily');
  const [completionType, setCompletionType] = useState<'boolean'|'quantity'|'time'|'count'>(habit?.completionType || 'boolean');
  const [targetValue, setTargetValue] = useState(habit?.targetValue?.toString() || '');
  const [targetUnit, setTargetUnit] = useState(habit?.targetUnit || '');
  const [timeWindowStart, setTimeWindowStart] = useState(habit?.timeWindowStart || '');
  const [timeWindowEnd, setTimeWindowEnd] = useState(habit?.timeWindowEnd || '');
  const [notes, setNotes] = useState(habit?.notes || '');
  const [timeError, setTimeError] = useState('');
  const [valueError, setValueError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const category = categorySelection === CUSTOM_CATEGORY_OPTION
    ? customCategory.trim()
    : categorySelection;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim() || !category || savingRef.current) return;
    const parsedTarget = completionType === 'boolean' || targetValue === '' ? undefined : Number(targetValue);
    const targetIsValid = parsedTarget === undefined || (
      Number.isFinite(parsedTarget) &&
      parsedTarget > 0 &&
      (completionType === 'quantity' || Number.isInteger(parsedTarget))
    );
    if (!targetIsValid) {
      setValueError(completionType === 'quantity'
        ? 'Target value must be greater than zero.'
        : 'Target value must be a positive whole number.');
      return;
    }
    setValueError('');
    
    let finalStart = timeWindowStart;
    let finalEnd = timeWindowEnd;
    
    setTimeError('');
    if (finalStart && finalEnd) {
      if (finalEnd <= finalStart) {
        setTimeError('Time window end must be after start.');
        return;
      }
    } else {
      if (finalStart && !finalEnd) finalEnd = '';
      if (!finalStart && finalEnd) finalStart = '';
      if (!finalStart && !finalEnd) {
        finalStart = '';
        finalEnd = '';
      }
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const cleanName = name.trim();
      const cleanUnit = targetUnit.trim();
      const cleanNotes = notes.trim();

      if (habit) {
        await db.habits.update(habit.id, {
          name: cleanName, category, frequency, completionType,
          targetValue: parsedTarget,
          targetUnit: cleanUnit, timeWindowStart: finalStart, timeWindowEnd: finalEnd,
          notes: cleanNotes, goalId: goalId || undefined, updatedAt: now
        });
        window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit updated.' }));
      } else {
        const newHabit: Habit = {
          id: crypto.randomUUID(),
          name: cleanName, category, frequency, completionType,
          targetValue: parsedTarget,
          targetUnit: cleanUnit, timeWindowStart: finalStart, timeWindowEnd: finalEnd,
          notes: cleanNotes, goalId: goalId || undefined,
          completionHistory: [], createdAt: now, updatedAt: now
        };
        await db.habits.add(newHabit);
        await onSaved?.(newHabit);
        window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit added.' }));
      }
      onClose();
    } catch (error) {
      console.error('[habits] save failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit could not be saved.' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!habit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await db.habits.delete(habit.id);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit deleted.' }));
      onClose();
    } catch (error) {
      console.error('[habits] delete failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit could not be deleted.' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const helperStyle: React.CSSProperties = {
    color: 'var(--dim)',
    fontSize: '10px',
    marginTop: '6px',
  };

  const targetValueLabel =
    completionType === 'time' ? 'TARGET MINUTES' :
    completionType === 'count' ? 'TARGET COUNT' :
    'TARGET VALUE';
  const targetUnitLabel =
    completionType === 'time' ? 'TIME UNIT' :
    completionType === 'count' ? 'COUNT LABEL' :
    'TARGET UNIT';
  const targetUnitPlaceholder =
    completionType === 'time' ? 'min' :
    completionType === 'count' ? 'times / reps / pages' :
    'ml / pages';
  const targetHelper =
    completionType === 'time' ? 'Track minutes spent.' :
    completionType === 'count' ? 'Track repeated counts.' :
    'Track a measured quantity.';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100
    }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={habit ? 'Edit habit' : 'New habit'} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--surface)', border: '1px solid var(--border-hi)',
        padding: '32px', width: '480px', maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 101
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ marginBottom: '24px' }} className="mono label">
          {habit ? 'EDIT HABIT' : 'NEW HABIT'}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>NAME</div>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus aria-label="Habit name"
                 style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>CATEGORY</div>
          <select
            value={categorySelection}
            onChange={e => setCategorySelection(e.target.value)}
            aria-label="Habit category"
            style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }}
          >
            {HABIT_CATEGORY_OPTIONS.map(option => (
              <option key={option} value={option}>{option.toUpperCase()}</option>
            ))}
            <option value={CUSTOM_CATEGORY_OPTION}>OTHER / CUSTOM</option>
          </select>
          {categorySelection === CUSTOM_CATEGORY_OPTION && (
            <input
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              aria-label="Custom habit category"
              placeholder="CUSTOM CATEGORY"
              style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0, marginTop: '8px' }}
            />
          )}
          <div className="mono" style={helperStyle}>Used for grouping and review context.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>FREQUENCY</div>
          <div style={{ display: 'flex' }}>
            {(['daily', 'weekly', 'custom'] as const).map(f => (
              <button key={f} type="button" aria-pressed={frequency === f} onClick={() => setFrequency(f)} className="mono" style={{
                flex: 1, border: '1px solid var(--border-hi)', padding: '6px 0', fontSize: '12px', textTransform: 'uppercase',
                background: frequency === f ? 'var(--surface2)' : 'transparent',
                color: frequency === f ? 'var(--primary)' : 'var(--dim)',
                cursor: 'pointer'
              }}>{f}</button>
            ))}
          </div>
          <div className="mono" style={helperStyle}>How often this habit is expected.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>COMPLETION TYPE</div>
          <div style={{ display: 'flex' }}>
            {(['boolean', 'quantity', 'time', 'count'] as const).map(t => (
              <button key={t} type="button" aria-pressed={completionType === t} onClick={() => setCompletionType(t)} className="mono" style={{
                flex: 1, border: '1px solid var(--border-hi)', padding: '6px 0', fontSize: '12px', textTransform: 'uppercase',
                background: completionType === t ? 'var(--surface2)' : 'transparent',
                color: completionType === t ? 'var(--primary)' : 'var(--dim)',
                cursor: 'pointer'
              }}>{t}</button>
            ))}
          </div>
          <div className="mono" style={helperStyle}>Controls how completion is recorded.</div>
        </div>

        {completionType !== 'boolean' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: '1 1 160px' }}>
              <div className="label" style={{ marginBottom: '6px' }}>{targetValueLabel}</div>
              <input type="number" min="0.01" step={completionType === 'quantity' ? 'any' : '1'} value={targetValue} onChange={e => setTargetValue(e.target.value)} aria-label={targetValueLabel}
                     style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
              <div className="mono" style={helperStyle}>{targetHelper}</div>
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <div className="label" style={{ marginBottom: '6px' }}>{targetUnitLabel}</div>
              <input value={targetUnit} onChange={e => setTargetUnit(e.target.value)} placeholder={targetUnitPlaceholder} aria-label={targetUnitLabel}
                     style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
              <div className="mono" style={helperStyle}>Optional display unit.</div>
            </div>
          </div>
        )}
        {valueError && (
          <div className="mono" style={{ color: 'var(--error)', fontSize: '11px', marginTop: '-8px', marginBottom: '16px' }}>
            {valueError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: '6px' }}>TIME WINDOW START</div>
            <input type="time" value={timeWindowStart} onChange={e => setTimeWindowStart(e.target.value)} aria-label="Habit time window start"
                   style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: '6px' }}>TIME WINDOW END</div>
            <input type="time" value={timeWindowEnd} onChange={e => setTimeWindowEnd(e.target.value)} aria-label="Habit time window end"
                   style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
        </div>
        {timeError && (
          <div className="mono" style={{ color: 'var(--error)', fontSize: '11px', marginTop: '-8px', marginBottom: '16px' }}>
            {timeError}
          </div>
        )}
        {!timeError && (
          <div className="mono" style={{ color: 'var(--dim)', fontSize: '10px', marginTop: '-8px', marginBottom: '16px' }}>
            Optional. Use HH:MM format.
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>NOTES</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} aria-label="Habit notes"
                    style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0, minHeight: '80px', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>GOAL</div>
          <select value={goalId} onChange={e => setGoalId(e.target.value)} aria-label="Habit goal"
                  style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)',
                           padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }}>
            {goalOptions.length === 0 && <option value="">NO GOALS AVAILABLE</option>}
            {goalOptions.length > 0 && <option value="">NONE</option>}
            {goalOptions.map(g => <option key={g.id} value={g.id}>{g.title.toUpperCase()}</option>)}
          </select>
          <div className="mono" style={helperStyle}>Optional link to an active goal.</div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button type="button" onClick={handleSave} disabled={!name.trim() || !category || saving} className="mono" style={{ background: 'var(--surface2)', color: 'var(--white)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', flex: 1 }}>
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="mono" style={{ background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}>
            CANCEL
          </button>
          {habit && (
            <button type="button" onClick={handleDelete} disabled={saving} className="mono" style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}>
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
