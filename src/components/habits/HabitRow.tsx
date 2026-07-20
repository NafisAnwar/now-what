import React, { useState } from 'react';
import type { Habit } from '../../types';
import { useTodayStr } from '../../utils/dateUtils';
import { isValidHabitCompletionValue } from '../../data/completions';

interface Props {
  habit: Habit;
  onComplete: (value?: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  goalTitle?: string;
}

export default function HabitRow({ habit, onComplete, onEdit, onDelete, goalTitle }: Props) {
  const [val, setVal] = useState<string>('');
  const todayStr = useTodayStr();
  const isCompletedToday = (habit.completionHistory || []).some(c => c.date === todayStr);
  const numericValue = val === '' ? undefined : Number(val);
  const canLog = isValidHabitCompletionValue(habit.completionType, numericValue);

  return (
    <div className="habit-row" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
    }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      <div className="habit-row-main" style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '14px', color: 'var(--body)' }}>{habit.name}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="mono label" style={{ color: 'var(--dim)', fontSize: '10px' }}>{habit.category}</span>
            <span className="mono" style={{ color: 'var(--dim)', fontSize: '10px', padding: '2px 4px', border: '1px solid var(--border)', textTransform: 'uppercase' }}>{habit.frequency}</span>
            {goalTitle && (
              <span className="mono label" style={{ color: 'var(--dim)', fontSize: '10px', padding: '2px 4px', border: '1px solid var(--border)' }}>
                GOAL: {goalTitle.length > 16 ? goalTitle.substring(0, 16).toUpperCase() + '…' : goalTitle.toUpperCase()}
              </span>
            )}
            {(habit.timeWindowStart || habit.timeWindowEnd) && (
              <span className="mono label" style={{ color: 'var(--dim)', fontSize: '10px' }}>
                {habit.timeWindowStart || ''} - {habit.timeWindowEnd || ''}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="habit-row-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isCompletedToday ? (
          <span className="mono label" style={{ color: 'var(--dim)' }}>[DONE]</span>
        ) : (
          habit.completionType === 'boolean' ? (
            <button type="button" onClick={() => onComplete()} aria-label={`Complete ${habit.name}`} className="mono" style={{
              background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '4px 8px', fontSize: '10px', cursor: 'pointer'
            }}>
              [COMPLETE]
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="0.01"
                step={habit.completionType === 'quantity' ? 'any' : '1'}
                value={val}
                onChange={e => setVal(e.target.value)}
                placeholder={habit.targetValue?.toString() || ''}
                aria-label={`Completion value for ${habit.name}`}
                style={{
                  background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '4px 8px', width: '60px', fontFamily: 'var(--mono)', fontSize: '12px', borderRadius: 0
                }}
              />
              {habit.targetUnit && <span className="mono" style={{ color: 'var(--dim)', fontSize: '10px' }}>{habit.targetUnit}</span>}
              <button type="button" disabled={!canLog} onClick={() => onComplete(numericValue)} className="mono" style={{
                background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '4px 8px', fontSize: '10px', cursor: 'pointer'
              }}>
                [LOG]
              </button>
            </div>
          )
        )}
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onEdit} aria-label={`Edit ${habit.name}`} className="mono label" style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>[EDIT]</button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${habit.name}`} className="mono label" style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>[DEL]</button>
        </div>
      </div>
    </div>
  );
}
