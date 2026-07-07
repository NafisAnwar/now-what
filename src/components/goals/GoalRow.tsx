import React from 'react';
import type { Goal, Task, Habit } from '../../types';

interface Props {
  goal: Goal;
  pendingTasks: Task[];
  allTasks: Task[];
  habits: Habit[];
  todayStr: string;
  onEdit: () => void;
}

export default function GoalRow({ goal, allTasks, habits, todayStr, onEdit }: Props) {
  const isDim = goal.status === 'paused';
  const isComplete = goal.status === 'complete';

  const linkedTasks = allTasks.filter(t => (goal.linkedTaskIds || []).includes(t.id));
  const completedLinkedTasksToday = linkedTasks.filter(
    t => t.status === 'complete' && t.completedAt?.startsWith(todayStr)
  ).length;

  const linkedHabits = habits.filter(h => (goal.linkedHabitIds || []).includes(h.id));
  const completedLinkedHabitsToday = linkedHabits.filter(
    h => h.completionHistory.some(c => c.date === todayStr)
  ).length;

  const hasLinkedItems = linkedTasks.length > 0 || linkedHabits.length > 0;

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          color: 'var(--body)',
          opacity: isDim ? 0.5 : isComplete ? 0.4 : 1,
          marginBottom: '6px',
        }}>
          {goal.title}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span className="mono" style={{
            fontSize: '10px',
            color: 'var(--dim)',
            padding: '2px 4px',
            border: '1px solid var(--border)',
            textTransform: 'uppercase',
          }}>
            {goal.horizon}
          </span>
          <span className="mono" style={{
            fontSize: '10px',
            color: 'var(--dim)',
            padding: '2px 4px',
            border: '1px solid var(--border)',
            textTransform: 'uppercase',
          }}>
            {goal.status}
          </span>
          {goal.category && (
            <span className="mono" style={{
              fontSize: '10px',
              color: 'var(--dim)',
              padding: '2px 4px',
              border: '1px solid var(--border)',
              textTransform: 'uppercase',
            }}>
              {goal.category}
            </span>
          )}
        </div>

        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
          {hasLinkedItems ? (
            <>
              {linkedTasks.length > 0 && (
                <span style={{ marginRight: '12px' }}>
                  tasks: {completedLinkedTasksToday}/{linkedTasks.length}
                </span>
              )}
              {linkedHabits.length > 0 && (
                <span>
                  habits: {completedLinkedHabitsToday}/{linkedHabits.length}
                </span>
              )}
            </>
          ) : (
            <span>— no linked items</span>
          )}
        </div>
      </div>

      <button
        onClick={onEdit}
        className="mono label"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--dim)',
          cursor: 'pointer',
          flexShrink: 0,
          fontSize: '10px',
        }}
      >
        [EDIT]
      </button>
    </div>
  );
}
