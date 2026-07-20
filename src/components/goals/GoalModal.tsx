import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Goal } from '../../types';
import {
  CUSTOM_CATEGORY_OPTION,
  GOAL_CATEGORY_OPTIONS,
  isCategoryOption,
} from '../../constants/categories';

interface Props {
  goal?: Goal;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border-hi)',
  color: 'var(--primary)',
  padding: '8px 12px',
  fontFamily: 'var(--mono)',
  width: '100%',
  fontSize: '13px',
  borderRadius: 0,
  outline: 'none',
  marginBottom: '16px',
};

const helperStyle: React.CSSProperties = {
  color: 'var(--dim)',
  fontSize: '10px',
  marginTop: '-10px',
  marginBottom: '14px',
};

export default function GoalModal({ goal, onClose }: Props) {
  const initialCategory = goal?.category || 'Personal';
  const [title, setTitle] = useState(goal?.title || '');
  const [categorySelection, setCategorySelection] = useState(
    isCategoryOption(initialCategory, GOAL_CATEGORY_OPTIONS)
      ? initialCategory
      : CUSTOM_CATEGORY_OPTION
  );
  const [customCategory, setCustomCategory] = useState(
    isCategoryOption(initialCategory, GOAL_CATEGORY_OPTIONS) ? '' : initialCategory
  );
  const [horizon, setHorizon] = useState<'week' | 'month' | 'semester' | 'year' | 'ongoing'>(goal?.horizon || 'month');
  const [status, setStatus] = useState<'active' | 'paused' | 'complete'>(goal?.status || 'active');
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>(goal?.linkedTaskIds || []);
  const [linkedHabitIds, setLinkedHabitIds] = useState<string[]>(goal?.linkedHabitIds || []);
  const [reviewNotes, setReviewNotes] = useState(goal?.reviewNotes || '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const category = categorySelection === CUSTOM_CATEGORY_OPTION
    ? customCategory.trim()
    : categorySelection;

  const pendingTasks = useLiveQuery(() => db.tasks.where('status').equals('pending').toArray(), []) || [];
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!title.trim() || !category || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      await db.transaction('rw', db.goals, db.tasks, db.habits, async () => {
      if (goal) {
        const thisGoalId = goal.id;
        const prevTaskIds = goal.linkedTaskIds || [];
        const removedTasks = prevTaskIds.filter(id => !linkedTaskIds.includes(id));
        const addedTasks = linkedTaskIds.filter(id => !prevTaskIds.includes(id));

        // Unlink removed tasks
        await Promise.all(removedTasks.map(id => db.tasks.update(id, { goalId: undefined })));

        // For newly added tasks: if they belonged to a different goal, remove them from that goal's array
        for (const id of addedTasks) {
          const task = await db.tasks.get(id);
          if (task?.goalId && task.goalId !== thisGoalId) {
            const oldGoal = await db.goals.get(task.goalId);
            if (oldGoal) {
              await db.goals.update(task.goalId, {
                linkedTaskIds: (oldGoal.linkedTaskIds || []).filter(tid => tid !== id),
                updatedAt: now,
              });
            }
          }
          await db.tasks.update(id, { goalId: thisGoalId });
        }

        const prevHabitIds = goal.linkedHabitIds || [];
        const removedHabits = prevHabitIds.filter(id => !linkedHabitIds.includes(id));
        const addedHabits = linkedHabitIds.filter(id => !prevHabitIds.includes(id));

        // Unlink removed habits
        await Promise.all(removedHabits.map(id => db.habits.update(id, { goalId: undefined })));

        // For newly added habits: reconcile prior ownership
        for (const id of addedHabits) {
          const habit = await db.habits.get(id);
          if (habit?.goalId && habit.goalId !== thisGoalId) {
            const oldGoal = await db.goals.get(habit.goalId);
            if (oldGoal) {
              await db.goals.update(habit.goalId, {
                linkedHabitIds: (oldGoal.linkedHabitIds || []).filter(hid => hid !== id),
                updatedAt: now,
              });
            }
          }
          await db.habits.update(id, { goalId: thisGoalId });
        }

        await db.goals.update(thisGoalId, {
          title: title.trim(), category, horizon, status, linkedTaskIds, linkedHabitIds,
          reviewNotes: reviewNotes.trim() || undefined, updatedAt: now,
        });
      } else {
        const newId = crypto.randomUUID();

        // For each newly linked task: reconcile prior ownership
        for (const id of linkedTaskIds) {
          const task = await db.tasks.get(id);
          if (task?.goalId && task.goalId !== newId) {
            const oldGoal = await db.goals.get(task.goalId);
            if (oldGoal) {
              await db.goals.update(task.goalId, {
                linkedTaskIds: (oldGoal.linkedTaskIds || []).filter(tid => tid !== id),
                updatedAt: now,
              });
            }
          }
          await db.tasks.update(id, { goalId: newId });
        }

        // For each newly linked habit: reconcile prior ownership
        for (const id of linkedHabitIds) {
          const habit = await db.habits.get(id);
          if (habit?.goalId && habit.goalId !== newId) {
            const oldGoal = await db.goals.get(habit.goalId);
            if (oldGoal) {
              await db.goals.update(habit.goalId, {
                linkedHabitIds: (oldGoal.linkedHabitIds || []).filter(hid => hid !== id),
                updatedAt: now,
              });
            }
          }
          await db.habits.update(id, { goalId: newId });
        }

        await db.goals.add({
          id: newId, title: title.trim(), category, horizon, status: 'active',
          linkedTaskIds, linkedHabitIds,
          reviewNotes: reviewNotes.trim() || undefined, createdAt: now, updatedAt: now,
        });
      }
      });

      window.dispatchEvent(new CustomEvent('show_toast', { detail: goal ? 'Goal updated.' : 'Goal added.' }));
      window.dispatchEvent(new Event('regenerate_now_what'));
      onClose();
    } catch (error) {
      console.error('[goals] save failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Goal could not be saved.' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!goal || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await db.transaction('rw', db.goals, db.tasks, db.habits, async () => {
        await Promise.all((goal.linkedTaskIds || []).map(id => db.tasks.update(id, { goalId: undefined })));
        await Promise.all((goal.linkedHabitIds || []).map(id => db.habits.update(id, { goalId: undefined })));
        await db.goals.delete(goal.id);
      });
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Goal deleted.' }));
      window.dispatchEvent(new Event('regenerate_now_what'));
      onClose();
    } catch (error) {
      console.error('[goals] delete failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Goal could not be deleted.' }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleTask = (id: string) => {
    setLinkedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleHabit = (id: string) => {
    setLinkedHabitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const segBtn = (selected: boolean): React.CSSProperties => ({
    flex: 1,
    border: '1px solid var(--border-hi)',
    padding: '6px 0',
    fontSize: '12px',
    textTransform: 'uppercase',
    background: selected ? 'var(--surface2)' : 'transparent',
    color: selected ? 'var(--primary)' : 'var(--dim)',
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
  });

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
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', overscrollBehavior: 'contain', zIndex: 101,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }} className="mono label">
          {goal ? 'EDIT GOAL' : 'NEW GOAL'}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>TITLE</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>CATEGORY</div>
          <select
            value={categorySelection}
            onChange={e => setCategorySelection(e.target.value)}
            aria-label="Goal category"
            style={inputStyle}
          >
            {GOAL_CATEGORY_OPTIONS.map(option => (
              <option key={option} value={option}>{option.toUpperCase()}</option>
            ))}
            <option value={CUSTOM_CATEGORY_OPTION}>OTHER / CUSTOM</option>
          </select>
          {categorySelection === CUSTOM_CATEGORY_OPTION && (
            <input
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              aria-label="Custom goal category"
              placeholder="CUSTOM CATEGORY"
              style={inputStyle}
            />
          )}
          <div className="mono" style={helperStyle}>Used for grouping and review context.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>HORIZON</div>
          <div style={{ display: 'flex' }}>
            {(['week', 'month', 'semester', 'year', 'ongoing'] as const).map(h => (
              <button type="button" key={h} aria-pressed={horizon === h} onClick={() => setHorizon(h)} style={segBtn(horizon === h)}>
                {h}
              </button>
            ))}
          </div>
          <div className="mono" style={{ ...helperStyle, marginTop: '6px' }}>Expected planning horizon for this goal.</div>
        </div>

        {goal && (
          <div style={{ marginBottom: '16px' }}>
            <div className="label" style={{ marginBottom: '6px' }}>STATUS</div>
            <div style={{ display: 'flex' }}>
              {(['active', 'paused', 'complete'] as const).map(s => (
                <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(s)} style={segBtn(status === s)}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mono" style={{ ...helperStyle, marginTop: '6px' }}>Only active goals boost current planning.</div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>LINKED TASKS</div>
          <div style={{
            maxHeight: '120px', overflowY: 'auto',
            border: '1px solid var(--border)', padding: '8px',
            background: 'var(--surface2)',
          }}>
            {pendingTasks.length === 0 ? (
              <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>No pending tasks.</div>
            ) : pendingTasks.map(task => (
              <label key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 0', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={linkedTaskIds.includes(task.id)}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="mono" style={{ fontSize: '12px', color: 'var(--body)', flex: 1 }}>
                  {task.title}
                </span>
                <span className="mono" style={{
                  fontSize: '10px', color: 'var(--dim)',
                  padding: '1px 4px', border: '1px solid var(--border)',
                  textTransform: 'uppercase',
                }}>
                  {task.priority === 'critical' ? 'CRIT' : task.priority.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>LINKED HABITS</div>
          <div style={{
            maxHeight: '120px', overflowY: 'auto',
            border: '1px solid var(--border)', padding: '8px',
            background: 'var(--surface2)',
          }}>
            {allHabits.length === 0 ? (
              <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>No habits.</div>
            ) : allHabits.map(habit => (
              <label key={habit.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 0', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={linkedHabitIds.includes(habit.id)}
                  onChange={() => toggleHabit(habit.id)}
                />
                <span className="mono" style={{ fontSize: '12px', color: 'var(--body)', flex: 1 }}>
                  {habit.name}
                </span>
                <span className="mono" style={{
                  fontSize: '10px', color: 'var(--dim)',
                  padding: '1px 4px', border: '1px solid var(--border)',
                  textTransform: 'uppercase',
                }}>
                  {habit.frequency}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className="label" style={{ marginBottom: '6px' }}>REVIEW NOTES</div>
          <textarea
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            style={{
              background: 'var(--surface2)', color: 'var(--primary)',
              border: '1px solid var(--border-hi)', padding: '8px 12px',
              fontFamily: 'var(--mono)', width: '100%', fontSize: '13px',
              borderRadius: 0, minHeight: '80px', resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || !category || saving}
            className="mono"
            style={{
              background: 'var(--surface2)', color: 'var(--white)',
              border: '1px solid var(--border-hi)', padding: '8px 16px',
              fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', flex: 1,
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
          {goal && (
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
        </div>
      </div>
    </div>
  );
}
