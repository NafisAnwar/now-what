import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Habit } from '../../types';

interface Props {
  habit?: Habit;
  onClose: () => void;
  onSaved?: (habit: Habit) => void | Promise<void>;
}

export default function HabitModal({ habit, onClose, onSaved }: Props) {
  const [name, setName] = useState(habit?.name || '');
  const [category, setCategory] = useState(habit?.category || 'Health');
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
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

    const now = new Date().toISOString();
    
    if (habit) {
      await db.habits.update(habit.id, {
        name, category, frequency, completionType,
        targetValue: targetValue ? Number(targetValue) : undefined,
        targetUnit, timeWindowStart: finalStart, timeWindowEnd: finalEnd, notes,
        goalId: goalId || undefined,
        updatedAt: now
      });
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit updated.' }));
    } else {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        name, category, frequency, completionType,
        targetValue: targetValue ? Number(targetValue) : undefined,
        targetUnit, timeWindowStart: finalStart, timeWindowEnd: finalEnd, notes,
        goalId: goalId || undefined,
        completionHistory: [],
        createdAt: now,
        updatedAt: now
      };
      await db.habits.add(newHabit);
      await onSaved?.(newHabit);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit added.' }));
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!habit) return;
    await db.habits.delete(habit.id);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit deleted.' }));
    onClose();
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
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--surface)', border: '1px solid var(--border-hi)',
        padding: '32px', width: '480px', maxWidth: 'calc(100vw - 48px)',
        maxHeight: '80vh', overflowY: 'auto', zIndex: 101
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ marginBottom: '24px' }} className="mono label">
          {habit ? 'EDIT HABIT' : 'NEW HABIT'}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>NAME</div>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus
                 style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>CATEGORY</div>
          <input value={category} onChange={e => setCategory(e.target.value)}
                 style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          <div className="mono" style={helperStyle}>Used for grouping and review context.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>FREQUENCY</div>
          <div style={{ display: 'flex' }}>
            {(['daily', 'weekly', 'custom'] as const).map(f => (
              <button key={f} onClick={() => setFrequency(f)} className="mono" style={{
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
              <button key={t} onClick={() => setCompletionType(t)} className="mono" style={{
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
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <div className="label" style={{ marginBottom: '6px' }}>{targetValueLabel}</div>
              <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                     style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
              <div className="mono" style={helperStyle}>{targetHelper}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="label" style={{ marginBottom: '6px' }}>{targetUnitLabel}</div>
              <input value={targetUnit} onChange={e => setTargetUnit(e.target.value)} placeholder={targetUnitPlaceholder}
                     style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
              <div className="mono" style={helperStyle}>Optional display unit.</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: '6px' }}>TIME WINDOW START</div>
            <input type="time" value={timeWindowStart} onChange={e => setTimeWindowStart(e.target.value)}
                   style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: '6px' }}>TIME WINDOW END</div>
            <input type="time" value={timeWindowEnd} onChange={e => setTimeWindowEnd(e.target.value)}
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
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0, minHeight: '80px', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>GOAL</div>
          <select value={goalId} onChange={e => setGoalId(e.target.value)}
                  style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)',
                           padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }}>
            {goalOptions.length === 0 && <option value="">NO GOALS AVAILABLE</option>}
            {goalOptions.length > 0 && <option value="">NONE</option>}
            {goalOptions.map(g => <option key={g.id} value={g.id}>{g.title.toUpperCase()}</option>)}
          </select>
          <div className="mono" style={helperStyle}>Optional link to an active goal.</div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={handleSave} className="mono" style={{ background: 'var(--surface2)', color: 'var(--white)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', flex: 1 }}>
            SAVE
          </button>
          <button onClick={onClose} className="mono" style={{ background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}>
            CANCEL
          </button>
          {habit && (
            <button onClick={handleDelete} className="mono" style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}>
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
