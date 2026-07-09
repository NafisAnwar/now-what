import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../ui/Modal';
import { db } from '../../data/db';

export default function TaskModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [priority, setPriority] = useState('medium');
  const [energy, setEnergy] = useState('medium');
  const [minutes, setMinutes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [goalId, setGoalId] = useState('');
  const activeGoals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []) || [];
  const goalOptions = Array.from(new Map(activeGoals.map(goal => [goal.id, goal])).values());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date().toISOString();
    
    await db.tasks.add({
      id: crypto.randomUUID(),
      title: title.trim(),
      category,
      priority: priority as any,
      status: 'pending',
      estimatedMinutes: minutes ? parseInt(minutes, 10) : undefined,
      dueDate: dueDate || undefined,
      energyRequired: energy as any,
      repeatRule: { type: repeat as any },
      notes: notes || undefined,
      goalId: goalId || undefined,
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now
    });

    window.dispatchEvent(new Event('regenerate_now_what'));
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Task added.' }));
    onClose();
  };

  const inputStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border-mid)',
    color: 'var(--body)',
    padding: '8px',
    width: '100%',
    fontFamily: 'var(--sans)',
    fontSize: '14px',
    marginBottom: '16px',
    outline: 'none'
  };
  const helperStyle: React.CSSProperties = {
    color: 'var(--dim)',
    fontSize: '10px',
    marginTop: '-10px',
    marginBottom: '14px',
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSave}>
        <div className="label" style={{ marginBottom: '8px' }}>TITLE *</div>
        <input 
          autoFocus
          style={inputStyle} 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>CATEGORY</div>
            <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
              {['School', 'Work', 'Health', 'Admin', 'Personal', 'Creative', 'Social', 'Maintenance'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="mono" style={helperStyle}>Used for grouping and NOW_WHAT? context.</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>PRIORITY</div>
            <select style={inputStyle} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
              <option value="critical">CRITICAL</option>
            </select>
            <div className="mono" style={helperStyle}>Critical overdue tasks stay highest priority.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>ENERGY</div>
            <select style={inputStyle} value={energy} onChange={e => setEnergy(e.target.value)}>
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
            </select>
            <div className="mono" style={helperStyle}>Estimated effort, not mood.</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>EST. MINUTES</div>
            <input 
              type="number" 
              style={inputStyle} 
              value={minutes} 
              onChange={e => setMinutes(e.target.value)} 
              min="1"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>DUE DATE</div>
            <input 
              type="date" 
              style={inputStyle} 
              value={dueDate} 
              onChange={e => setDueDate(e.target.value)} 
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>REPEAT</div>
            <select style={inputStyle} value={repeat} onChange={e => setRepeat(e.target.value)}>
              <option value="none">NONE</option>
              <option value="daily">DAILY</option>
              <option value="weekly">WEEKLY</option>
            </select>
            <div className="mono" style={helperStyle}>Repeats create future task context.</div>
          </div>
        </div>

        <div className="label" style={{ marginBottom: '8px' }}>GOAL</div>
        <select style={inputStyle} value={goalId} onChange={e => setGoalId(e.target.value)}>
          {goalOptions.length === 0 && <option value="">NO GOALS AVAILABLE</option>}
          {goalOptions.length > 0 && <option value="">NONE</option>}
          {goalOptions.map(g => (
            <option key={g.id} value={g.id}>{g.title.toUpperCase()}</option>
          ))}
        </select>
        <div className="mono" style={helperStyle}>Optional link to an active goal.</div>

        <div className="label" style={{ marginBottom: '8px' }}>NOTES</div>
        <textarea 
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
          value={notes} 
          onChange={e => setNotes(e.target.value)} 
        />

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            type="button" 
            onClick={onClose}
            className="mono"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-hi)',
              color: 'var(--dim)',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            [CANCEL]
          </button>
          <button 
            type="submit" 
            className="mono"
            style={{
              background: 'var(--primary)',
              border: '1px solid var(--primary)',
              color: 'var(--bg)',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            [SAVE]
          </button>
        </div>
      </form>
    </Modal>
  );
}
