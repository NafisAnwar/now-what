import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  getOrCreateTodaysPlan,
  setTodaysPrimaryFocus,
  addTaskToPlan,
  removeTaskFromPlan,
  addHabitToPlan,
  removeHabitFromPlan,
  carryOverTask,
  addCalendarBlockToPlan,
  removeCalendarBlockFromPlan,
} from '../../engine/dailyPlan';
import type { Task, Habit, CalendarBlock } from '../../types';
import { isLocalDate, useTodayStr } from '../../utils/dateUtils';

export default function DailyPlanPanel() {
  const todayStr = useTodayStr();
  const plan = useLiveQuery(() => db.dailyPlans.where('date').equals(todayStr).first(), [todayStr]);
  const allPendingTasks = useLiveQuery(() => db.tasks.where('status').equals('pending').toArray(), []) || [];
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) || [];
  const allBlocks = useLiveQuery(() => db.calendarBlocks.toArray(), []) || [];

  const [editingFocus, setEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showHabitPicker, setShowHabitPicker] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  useEffect(() => {
    getOrCreateTodaysPlan();
  }, []);

  const plannedTasks: Task[] = (plan?.plannedTaskIds || [])
    .map(id => allPendingTasks.find(t => t.id === id))
    .filter(Boolean) as Task[];

  const unplannedTasks = allPendingTasks.filter(t => !(plan?.plannedTaskIds || []).includes(t.id));

  const plannedHabits: Habit[] = (plan?.plannedHabitIds || [])
    .map(id => allHabits.find(h => h.id === id))
    .filter(Boolean) as Habit[];

  const unplannedHabits = allHabits.filter(h => !(plan?.plannedHabitIds || []).includes(h.id));

  const carryOverCandidates = allPendingTasks.filter(
    t => t.dueDate && t.dueDate < todayStr && !(plan?.carryOverTaskIds || []).includes(t.id)
  );

  const plannedBlocks: CalendarBlock[] = (plan?.calendarBlockIds || [])
    .map(id => allBlocks.find(b => b.id === id))
    .filter(Boolean) as CalendarBlock[];

  const unplannedTodayBlocks = allBlocks.filter(b =>
    isLocalDate(b.startAt, todayStr) && !(plan?.calendarBlockIds || []).includes(b.id)
  );

  const handleSaveFocus = async () => {
    if (!plan) return;
    await setTodaysPrimaryFocus(plan.id, focusInput);
    setEditingFocus(false);
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  };

  const dimBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    padding: '3px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  };

  const removeBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '0 4px',
    flexShrink: 0,
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px',
        borderTop: '1px solid var(--border)',
        paddingTop: '16px',
      }}>
        <div className="mono label" style={{ fontSize: '10px', color: 'var(--dim)' }}>
          TODAY'S PLAN
        </div>
        <button
          onClick={() => {
            setFocusInput(plan?.primaryFocus || '');
            setEditingFocus(true);
          }}
          style={dimBtn}
        >
          {plan?.primaryFocus ? '[EDIT FOCUS]' : '[SET FOCUS]'}
        </button>
      </div>

      {/* PRIMARY FOCUS */}
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={sectionLabel}>PRIMARY FOCUS</div>
        {editingFocus ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={focusInput}
              onChange={e => setFocusInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveFocus(); if (e.key === 'Escape') setEditingFocus(false); }}
              autoFocus
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border-hi)',
                color: 'var(--primary)', padding: '6px 10px', fontFamily: 'var(--mono)',
                fontSize: '13px', flex: 1, outline: 'none', borderRadius: 0,
              }}
            />
            <button onClick={handleSaveFocus} style={dimBtn}>[SAVE]</button>
            <button onClick={() => setEditingFocus(false)} style={dimBtn}>[CANCEL]</button>
          </div>
        ) : plan?.primaryFocus ? (
          <div className="mono" style={{ fontSize: '13px', color: 'var(--primary)' }}>
            {plan.primaryFocus}
          </div>
        ) : (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
            — focus not set
          </div>
        )}
      </div>

      {/* PLANNED TASKS */}
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={sectionLabel}>TASKS</div>
        {plannedTasks.length === 0 ? (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
            No tasks added.
          </div>
        ) : (
          plannedTasks.map(task => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0', gap: '8px',
            }}>
              <span style={{ fontSize: '14px', color: 'var(--body)', flex: 1, minWidth: 0 }}>
                {task.title}
              </span>
              <span className="mono" style={{
                fontSize: '10px', color: 'var(--dim)',
                padding: '2px 4px', border: '1px solid var(--border)', flexShrink: 0,
                textTransform: 'uppercase',
              }}>
                {task.priority === 'critical' ? 'CRIT' : task.priority.toUpperCase()}
              </span>
              <button
                onClick={async () => {
                  if (!plan) return;
                  await removeTaskFromPlan(plan.id, task.id, plan.plannedTaskIds);
                }}
                style={removeBtn}
                title="Remove from plan"
              >
                [−]
              </button>
            </div>
          ))
        )}

        <button
          onClick={() => setShowTaskPicker(p => !p)}
          style={{ ...dimBtn, marginTop: '8px' }}
        >
          [+ ADD TASK]
        </button>

        {showTaskPicker && (
          <div style={{ marginTop: '8px', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {unplannedTasks.length === 0 ? (
              <div className="mono" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--dim)' }}>
                No unplanned tasks remaining.
              </div>
            ) : unplannedTasks.map(task => (
              <div
                key={task.id}
                onClick={async () => {
                  if (!plan) return;
                  await addTaskToPlan(plan.id, task.id, plan.plannedTaskIds);
                  setShowTaskPicker(false);
                }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '8px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="mono" style={{ fontSize: '13px', color: 'var(--body)', flex: 1 }}>
                  {task.title}
                </span>
                <span className="mono" style={{
                  fontSize: '10px', color: 'var(--dim)',
                  padding: '2px 4px', border: '1px solid var(--border)', textTransform: 'uppercase',
                }}>
                  {task.priority === 'critical' ? 'CRIT' : task.priority.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PLANNED HABITS */}
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={sectionLabel}>HABITS</div>
        {plannedHabits.length === 0 ? (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
            No habits added.
          </div>
        ) : (
          plannedHabits.map(habit => (
            <div key={habit.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0', gap: '8px',
            }}>
              <span style={{ fontSize: '14px', color: 'var(--body)', flex: 1, minWidth: 0 }}>
                {habit.name}
              </span>
              <span className="mono" style={{
                fontSize: '10px', color: 'var(--dim)',
                padding: '2px 4px', border: '1px solid var(--border)', flexShrink: 0,
                textTransform: 'uppercase',
              }}>
                {habit.frequency}
              </span>
              <button
                onClick={async () => {
                  if (!plan) return;
                  await removeHabitFromPlan(plan.id, habit.id, plan.plannedHabitIds);
                }}
                style={removeBtn}
                title="Remove from plan"
              >
                [−]
              </button>
            </div>
          ))
        )}

        <button
          onClick={() => setShowHabitPicker(p => !p)}
          style={{ ...dimBtn, marginTop: '8px' }}
        >
          [+ ADD HABIT]
        </button>

        {showHabitPicker && (
          <div style={{ marginTop: '8px', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {unplannedHabits.length === 0 ? (
              <div className="mono" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--dim)' }}>
                No unplanned habits remaining.
              </div>
            ) : unplannedHabits.map(habit => (
              <div
                key={habit.id}
                onClick={async () => {
                  if (!plan) return;
                  await addHabitToPlan(plan.id, habit.id, plan.plannedHabitIds);
                  setShowHabitPicker(false);
                }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '8px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="mono" style={{ fontSize: '13px', color: 'var(--body)', flex: 1 }}>
                  {habit.name}
                </span>
                <span className="mono" style={{
                  fontSize: '10px', color: 'var(--dim)',
                  padding: '2px 4px', border: '1px solid var(--border)', textTransform: 'uppercase',
                }}>
                  {habit.frequency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CALENDAR BLOCKS */}
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={sectionLabel}>CALENDAR BLOCKS</div>
        {plannedBlocks.length === 0 ? (
          <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>No calendar blocks added.</div>
        ) : plannedBlocks.map(block => {
          const fmt = (iso: string) => iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso;
          return (
            <div key={block.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', gap: '8px' }}>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--dim)', flexShrink: 0 }}>
                {fmt(block.startAt)}–{fmt(block.endAt)}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--body)', flex: 1, minWidth: 0 }}>{block.title}</span>
              <button onClick={async () => { if (!plan) return; await removeCalendarBlockFromPlan(plan.id, block.id, plan.calendarBlockIds ?? []); }} style={removeBtn}>[−]</button>
            </div>
          );
        })}
        <button onClick={() => setShowBlockPicker(p => !p)} style={{ ...dimBtn, marginTop: '8px' }}>[+ ADD BLOCK]</button>
        {showBlockPicker && (
          <div style={{ marginTop: '8px', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {unplannedTodayBlocks.length === 0 ? (
              <div className="mono" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--dim)' }}>No unplanned blocks for today.</div>
            ) : unplannedTodayBlocks.map(block => {
              const fmt = (iso: string) => iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso;
              return (
                <div key={block.id}
                  onClick={async () => { if (!plan) return; await addCalendarBlockToPlan(plan.id, block.id, plan.calendarBlockIds ?? []); setShowBlockPicker(false); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>{fmt(block.startAt)}–{fmt(block.endAt)}</span>
                  <span className="mono" style={{ fontSize: '13px', color: 'var(--body)', flex: 1 }}>{block.title}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CARRY OVER */}
      {carryOverCandidates.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={sectionLabel}>PENDING FROM PREVIOUS DATES</div>
          {carryOverCandidates.map(task => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0', gap: '8px',
            }}>
              <span style={{ fontSize: '14px', color: 'var(--body)', flex: 1, minWidth: 0 }}>
                {task.title}
              </span>
              {task.dueDate && (
                <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', flexShrink: 0 }}>
                  {task.dueDate}
                </span>
              )}
              <button
                onClick={async () => {
                  if (!plan) return;
                  await carryOverTask(plan.id, task.id, plan.carryOverTaskIds, plan.plannedTaskIds);
                  window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Carried over.' }));
                }}
                style={dimBtn}
              >
                [CARRY OVER]
              </button>
            </div>
          ))}
        </div>
      )}

      {/* REVIEW STATUS */}
      {plan && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            REVIEW:{' '}
          </span>
          <span className="mono" style={{ fontSize: '10px', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {plan.reviewStatus === 'complete' ? 'COMPLETE'
              : plan.reviewStatus === 'in_progress' ? 'IN PROGRESS'
              : 'NOT STARTED'}
          </span>
        </div>
      )}
    </div>
  );
}
