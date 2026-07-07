import React, { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  getOrCreateDailyReview,
  refreshDailyReview,
  saveDailyReviewNote,
  completeDailyReview,
} from '../../data/review';
import { useTodayStr } from '../../utils/dateUtils';
import CarryOverReview from './CarryOverReview';
import type { DailyReview, Task, Habit } from '../../types';

interface Props {
  date: string; // YYYY-MM-DD
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--dim)',
  fontFamily: 'var(--mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
  marginTop: '20px',
};

const metricRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '3px 0',
  borderBottom: '1px solid var(--border)',
};

const metricLabel: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--dim)',
  fontFamily: 'var(--mono)',
};

const metricValue: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--body)',
  fontFamily: 'var(--mono)',
};

// Safe accessors — back-compat with pre-Step-7 review records that lack new fields
const safeIds = (
  r: DailyReview | null,
  field: 'completedTaskIds' | 'missedTaskIds' | 'completedHabitIds' | 'calendarBlockIds' | 'carryOverTaskIds'
): string[] => r?.[field] ?? [];

const safeNum = (
  r: DailyReview | null,
  field: 'focusMinutes' | 'distractionMinutes' | 'restMinutes' | 'waterMl' | 'mealsLogged' | 'movementMinutes'
): number => r?.[field] ?? 0;

export default function DailyReviewPanel({ date }: Props) {
  const todayStr = useTodayStr();

  const [review, setReview] = useState<DailyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [saving, setSaving] = useState(false);

  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) || [];
  const allBlocks = useLiveQuery(() => db.calendarBlocks.toArray(), []) || [];
  const activeGoals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []) || [];

  const loadReview = useCallback(async () => {
    setLoading(true);
    const r = await getOrCreateDailyReview(date);
    setReview(r);
    setNoteText(r.reflectionNote || r.reflection || '');
    setLoading(false);
  }, [date]);

  useEffect(() => { loadReview(); }, [loadReview]);

  const handleRefresh = async () => {
    if (!review) return;
    setLoading(true);
    const updated = await refreshDailyReview(review.id, date);
    setReview(updated);
    setNoteText(updated.reflectionNote || '');
    setLoading(false);
  };

  const handleSaveNote = async () => {
    if (!review) return;
    setSaving(true);
    await saveDailyReviewNote(review.id, noteText);
    setReview(prev => prev ? { ...prev, reflectionNote: noteText.trim() || undefined } : prev);
    setEditingNote(false);
    setSaving(false);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Note saved.' }));
  };

  const handleComplete = async () => {
    if (!review) return;
    setSaving(true);
    await completeDailyReview(review.id, date);
    setReview(prev => prev ? { ...prev, status: 'complete' } : prev);
    setSaving(false);
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Review marked complete.' }));
    window.dispatchEvent(new Event('regenerate_now_what'));
  };

  const getTaskTitle = (id: string) => allTasks.find(t => t.id === id)?.title || id;
  const getHabitName = (id: string) => allHabits.find(h => h.id === id)?.name || id;
  const getBlockTitle = (id: string) => allBlocks.find(b => b.id === id)?.title || id;
  const getBlockTime = (id: string) => {
    const b = allBlocks.find(b => b.id === id);
    if (!b) return '';
    const fmt = (iso: string) => iso.includes('T') ? iso.split('T')[1].slice(0, 5) : '';
    return `${fmt(b.startAt)}–${fmt(b.endAt)}`;
  };

  const completedTaskIds = safeIds(review, 'completedTaskIds');
  const missedTaskIds = safeIds(review, 'missedTaskIds');
  const completedHabitIds = safeIds(review, 'completedHabitIds');
  const calendarBlockIds = safeIds(review, 'calendarBlockIds');
  const carryOverTaskIds = safeIds(review, 'carryOverTaskIds');

  const completedHabitIdSet = new Set(completedHabitIds);
  const allDailyHabits = allHabits.filter((h: Habit) => h.frequency === 'daily');
  const incompleteHabits: Habit[] = allDailyHabits.filter((h: Habit) => !completedHabitIdSet.has(h.id));

  const pendingPlannedTasks: Task[] = missedTaskIds
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean) as Task[];

  const goalsTouched = activeGoals.filter(g => {
    const completedSet = new Set(completedTaskIds);
    return (g.linkedTaskIds || []).some(id => completedSet.has(id));
  });

  // Allow completing any review for today or past dates (not future)
  const canComplete = date <= todayStr && review?.status !== 'complete';
  const reviewStatus = review?.status ?? 'draft';
  const summaryText = review?.generatedSummary ?? '';

  if (loading) {
    return (
      <div className="mono" style={{ color: 'var(--dim)', fontSize: '12px', padding: '16px 0' }}>
        GENERATING REVIEW...
      </div>
    );
  }

  if (!review) return null;

  return (
    <div>
      {/* Status + refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span className="mono" style={{
          fontSize: '10px',
          color: reviewStatus === 'complete' ? 'var(--dim)' : 'var(--primary)',
          border: '1px solid var(--border)',
          padding: '2px 6px',
          textTransform: 'uppercase',
        }}>
          {reviewStatus === 'complete' ? 'COMPLETE' : 'DRAFT'}
        </span>
        <button
          onClick={handleRefresh}
          className="mono"
          style={{ background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
        >
          [REFRESH DATA]
        </button>
      </div>

      {/* Summary */}
      {summaryText && (
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          padding: '12px 16px',
          marginBottom: '8px',
        }}>
          <div className="mono" style={{ fontSize: '12px', color: 'var(--secondary)', lineHeight: 1.6 }}>
            {summaryText}
          </div>
        </div>
      )}

      {/* COMPLETED TASKS */}
      <div style={sectionLabel}>COMPLETED TASKS ({completedTaskIds.length})</div>
      {completedTaskIds.length === 0 ? (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>none</div>
      ) : (
        completedTaskIds.map(id => (
          <div key={id} className="mono" style={{ fontSize: '12px', color: 'var(--body)', padding: '2px 0' }}>
            ✓ {getTaskTitle(id)}
          </div>
        ))
      )}

      {/* PENDING PLANNED TASKS */}
      {pendingPlannedTasks.length > 0 && (
        <>
          <div style={sectionLabel}>PENDING PLANNED TASKS ({pendingPlannedTasks.length})</div>
          <CarryOverReview
            pendingTasks={pendingPlannedTasks}
            date={date}
            onAction={() => {
              if (review) refreshDailyReview(review.id, date).then(setReview);
            }}
          />
        </>
      )}

      {/* HABITS */}
      <div style={sectionLabel}>HABITS</div>
      {completedHabitIds.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          {completedHabitIds.map(id => (
            <div key={id} className="mono" style={{ fontSize: '12px', color: 'var(--body)', padding: '2px 0' }}>
              ✓ {getHabitName(id)}
            </div>
          ))}
        </div>
      )}
      {incompleteHabits.length > 0 && (
        <div>
          {incompleteHabits.map(h => (
            <div key={h.id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>
              — {h.name}
            </div>
          ))}
        </div>
      )}
      {allDailyHabits.length === 0 && (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>no daily habits</div>
      )}

      {/* ACTIVITY METRICS */}
      <div style={sectionLabel}>ACTIVITY</div>
      <div>
        {(
          [
            ['Focus', `${safeNum(review, 'focusMinutes')} min`],
            ['Distraction', `${safeNum(review, 'distractionMinutes')} min`],
            ['Rest', `${safeNum(review, 'restMinutes')} min`],
            ['Movement', `${safeNum(review, 'movementMinutes')} min`],
            ['Water', `${safeNum(review, 'waterMl')} ml`],
            ['Meals', `${safeNum(review, 'mealsLogged')}`],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} style={metricRow}>
            <span style={metricLabel}>{label}</span>
            <span style={metricValue}>{value}</span>
          </div>
        ))}
      </div>

      {/* CALENDAR BLOCKS */}
      {calendarBlockIds.length > 0 && (
        <>
          <div style={sectionLabel}>CALENDAR BLOCKS ({calendarBlockIds.length})</div>
          {calendarBlockIds.map(id => (
            <div key={id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>
              {getBlockTime(id) && <span style={{ marginRight: '8px' }}>{getBlockTime(id)}</span>}
              {getBlockTitle(id)}
            </div>
          ))}
        </>
      )}

      {/* GOALS TOUCHED */}
      {goalsTouched.length > 0 && (
        <>
          <div style={sectionLabel}>GOALS TOUCHED</div>
          {goalsTouched.map(g => (
            <div key={g.id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>
              — {g.title}
            </div>
          ))}
        </>
      )}

      {/* ALREADY CARRIED OVER */}
      {carryOverTaskIds.length > 0 && (
        <>
          <div style={sectionLabel}>CARRIED OVER ({carryOverTaskIds.length})</div>
          {carryOverTaskIds.map(id => (
            <div key={id} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>
              → {getTaskTitle(id)}
            </div>
          ))}
        </>
      )}

      {/* REFLECTION NOTE */}
      <div style={sectionLabel}>REFLECTION NOTE</div>
      {editingNote ? (
        <div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={4}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border-hi)',
              color: 'var(--primary)', padding: '8px 12px', fontFamily: 'var(--mono)',
              fontSize: '12px', width: '100%', resize: 'vertical', outline: 'none',
              borderRadius: 0, boxSizing: 'border-box',
            }}
            autoFocus
            placeholder="Optional. Keep it factual."
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="mono"
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border-hi)',
                color: 'var(--white)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {saving ? 'SAVING...' : '[SAVE]'}
            </button>
            <button
              onClick={() => { setNoteText(review.reflectionNote || ''); setEditingNote(false); }}
              className="mono"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              [CANCEL]
            </button>
          </div>
        </div>
      ) : (
        <div>
          {(review.reflectionNote || review.reflection) ? (
            <div style={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.6, marginBottom: '8px' }}>
              {review.reflectionNote || review.reflection}
            </div>
          ) : (
            <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
              — not added
            </div>
          )}
          <button
            onClick={() => setEditingNote(true)}
            className="mono"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--dim)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {(review.reflectionNote || review.reflection) ? '[EDIT NOTE]' : '[ADD NOTE]'}
          </button>
        </div>
      )}

      {/* MARK COMPLETE — available for today or any past incomplete review */}
      {canComplete && (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          {date < todayStr && (
            <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px' }}>
              Complete previous review.
            </div>
          )}
          <button
            onClick={handleComplete}
            disabled={saving}
            className="mono"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border-hi)',
              color: 'var(--white)', fontSize: '12px', padding: '8px 20px',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            {saving ? 'SAVING...' : '[MARK REVIEW COMPLETE]'}
          </button>
        </div>
      )}

      {reviewStatus === 'complete' && (
        <div style={{ marginTop: '16px' }}>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
            Review completed. Updated {new Date(review.updatedAt).toLocaleTimeString()}.
          </div>
        </div>
      )}
    </div>
  );
}
