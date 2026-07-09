import React, { useState, useEffect } from 'react';
import { db } from '../../data/db';
import type { LogType, ActivityLog } from '../../types';

type LogExtra = Partial<Omit<ActivityLog, 'id' | 'type' | 'label' | 'createdAt'>>;

interface Props {
  onClose: () => void;
}

export default function QuickLogModal({ onClose }: Props) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const logDirectly = async (type: LogType, actLabel: string, extra: LogExtra = {}) => {
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type,
      label: actLabel,
      createdAt: new Date().toISOString(),
      ...extra
    });
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Log saved.' }));
    window.dispatchEvent(new Event('regenerate_now_what'));
    onClose();
  };

  const handleLogAction = async () => {
    if (!activeAction) return;
    const durNum = duration ? Number(duration) : undefined;
    const valNum = value ? Number(value) : undefined;

    switch (activeAction) {
      case 'focus':
        await logDirectly('focus', `Focus — ${durNum || 0}min`, { durationMinutes: durNum, notes });
        break;
      case 'meal':
        await logDirectly('meal', label || 'Meal', { notes });
        break;
      case 'exercise':
        await logDirectly('exercise', label || `Exercise — ${durNum || 0}min`, { durationMinutes: durNum });
        break;
      case 'mood':
        await logDirectly('mood', `Mood — ${valNum || 0}/5`, { quantity: valNum, notes });
        break;
      case 'energy':
        await logDirectly('energy', `Energy — ${valNum || 0}/5`, { quantity: valNum, notes });
        break;
      case 'rest':
        await logDirectly('rest', `Rest — ${durNum || 0}min`, { durationMinutes: durNum, notes });
        break;
      case 'distraction':
        await logDirectly('distraction', `Distraction — ${durNum || 0}min`, { durationMinutes: durNum, notes });
        break;
    }
  };

  const handleLogNote = async () => {
    if (!noteText.trim()) return;
    await logDirectly('note', noteText);
  };

  const renderActionFields = () => {
    if (!activeAction) return null;
    return (
      <div style={{ marginTop: '16px', padding: '16px', border: '1px solid var(--border-hi)', background: 'var(--surface2)' }}>
        <div className="mono label" style={{ marginBottom: '16px' }}>{activeAction.toUpperCase()} DETAILS</div>
        
        {(activeAction === 'focus' || activeAction === 'exercise' || activeAction === 'rest' || activeAction === 'distraction') && (
          <div style={{ marginBottom: '16px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>DURATION (MINUTES)</div>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                   style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
        )}

        {(activeAction === 'meal' || activeAction === 'exercise') && (
          <div style={{ marginBottom: '16px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>LABEL (OPTIONAL)</div>
            <input value={label} onChange={e => setLabel(e.target.value)}
                   style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
        )}

        {(activeAction === 'mood' || activeAction === 'energy') && (
          <div style={{ marginBottom: '16px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>VALUE (1-5)</div>
            <input type="number" min="1" max="5" value={value} onChange={e => setValue(e.target.value)}
                   style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
        )}

        {(activeAction !== 'exercise') && (
          <div style={{ marginBottom: '16px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>NOTES (OPTIONAL)</div>
            <input value={notes} onChange={e => setNotes(e.target.value)}
                   style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0 }} />
          </div>
        )}

        <button onClick={handleLogAction} className="mono" style={{ background: 'var(--white)', color: 'var(--bg)', border: 'none', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', width: '100%' }}>
          LOG {activeAction}
        </button>
      </div>
    );
  };

  const actionButton = (key: string, txt: string, isDirect: boolean = false) => {
    const active = activeAction === key;
    return (
      <button
        onClick={() => {
          if (isDirect) {
            if (key === 'water_250') logDirectly('water', 'Water — 250ml', { quantity: 250, unit: 'ml' });
            if (key === 'water_500') logDirectly('water', 'Water — 500ml', { quantity: 500, unit: 'ml' });
          } else {
            setActiveAction(key);
          }
        }}
        className="mono"
        style={{
          background: active ? 'var(--surface2)' : 'transparent',
          color: active ? 'var(--primary)' : 'var(--dim)',
          border: '1px solid var(--border-hi)',
          padding: '12px 8px',
          fontSize: '11px',
          cursor: 'pointer',
          textTransform: 'uppercase'
        }}
      >
        {txt}
      </button>
    );
  };

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
          QUICK LOG
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {actionButton('water_250', 'WATER +250ML', true)}
          {actionButton('water_500', 'WATER +500ML', true)}
          {actionButton('focus', 'FOCUS')}
          {actionButton('meal', 'MEAL')}
          {actionButton('exercise', 'EXERCISE')}
          {actionButton('mood', 'MOOD')}
          {actionButton('energy', 'ENERGY')}
          {actionButton('rest', 'REST')}
          {actionButton('distraction', 'DISTRACTION')}
        </div>

        {renderActionFields()}

        <div style={{ marginTop: '32px', marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>FREE NOTE</div>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    style={{ background: 'var(--surface2)', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '8px 12px', fontFamily: 'var(--mono)', width: '100%', fontSize: '13px', borderRadius: 0, minHeight: '80px', resize: 'vertical' }} />
          <button onClick={handleLogNote} className="mono" style={{ background: 'var(--surface2)', color: 'var(--white)', border: '1px solid var(--border-hi)', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', width: '100%', marginTop: '8px' }}>
            LOG NOTE
          </button>
        </div>

      </div>
    </div>
  );
}
