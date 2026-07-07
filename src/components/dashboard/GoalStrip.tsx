import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { getTodayStr, isLocalDate } from '../../utils/dateUtils';

export default function GoalStrip() {
  const activeGoals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []);
  const allHabits = useLiveQuery(() => db.habits.toArray(), []);

  if (!activeGoals || activeGoals.length === 0) return null;

  const todayStr = getTodayStr();
  const MAX_VISIBLE = 4;
  const visibleGoals = activeGoals.slice(0, MAX_VISIBLE);
  const overflowCount = activeGoals.length - MAX_VISIBLE;

  return (
    <div style={{
      marginBottom: '32px',
      borderTop: '1px solid var(--border)',
      paddingTop: '16px',
    }}>
      <div className="mono label" style={{
        fontSize: '10px', color: 'var(--dim)',
        marginBottom: '12px',
      }}>
        ACTIVE GOALS
      </div>

      {visibleGoals.map(goal => {
        const linkedTasks = (allTasks || []).filter(t => (goal.linkedTaskIds || []).includes(t.id));
        const completedLinkedTasksToday = linkedTasks.filter(
          t => t.status === 'complete' && !!t.completedAt && isLocalDate(t.completedAt, todayStr)
        ).length;

        const linkedHabits = (allHabits || []).filter(h => (goal.linkedHabitIds || []).includes(h.id));
        const completedLinkedHabitsToday = linkedHabits.filter(
          h => h.completionHistory.some(c => c.date === todayStr)
        ).length;

        const hasLinkedItems = linkedTasks.length > 0 || linkedHabits.length > 0;
        const truncTitle = goal.title.length > 24 ? goal.title.substring(0, 24) + '…' : goal.title;

        return (
          <div key={goal.id} className="mono" style={{
            fontSize: '12px', color: 'var(--dim)',
            padding: '3px 0',
            display: 'flex', gap: '12px', alignItems: 'baseline',
          }}>
            <span style={{ color: 'var(--body)' }}>{truncTitle}</span>
            {hasLinkedItems && (
              <span style={{ fontSize: '11px' }}>
                {linkedTasks.length > 0 && (
                  <span style={{ marginRight: '8px' }}>
                    tasks {completedLinkedTasksToday}/{linkedTasks.length}
                  </span>
                )}
                {linkedHabits.length > 0 && (
                  <span>
                    habits {completedLinkedHabitsToday}/{linkedHabits.length}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', paddingTop: '4px' }}>
          + {overflowCount} more
        </div>
      )}
    </div>
  );
}
