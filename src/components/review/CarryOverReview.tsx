import React, { useState } from 'react';
import { carryTaskToTomorrow, markTaskMissedForDate } from '../../data/review';
import { dayAfter, useTodayStr } from '../../utils/dateUtils';
import type { Task } from '../../types';

interface Props {
  pendingTasks: Task[];
  date: string;       // review date (YYYY-MM-DD)
  onAction: () => void;
}

type Resolution = 'carry' | 'missed' | 'skip' | 'keep';

export default function CarryOverReview({ pendingTasks, date, onAction }: Props) {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const todayStr = useTodayStr();
  // "Tomorrow" relative to the review date — if reviewing yesterday, this is today
  const carryTargetDate = dayAfter(date);
  const carryLabel = carryTargetDate === todayStr ? 'CARRY TO TODAY' : 'CARRY TO TOMORROW';

  const act = async (taskId: string, resolution: Resolution) => {
    setLoading(l => ({ ...l, [taskId]: true }));
    try {
      if (resolution === 'carry') {
        await carryTaskToTomorrow(taskId, date);
      } else if (resolution === 'missed') {
        await markTaskMissedForDate(taskId, date);
      }
      // 'skip' and 'keep' require no DB write
      setResolved(r => ({ ...r, [taskId]: resolution }));
      onAction();
    } finally {
      setLoading(l => ({ ...l, [taskId]: false }));
    }
  };

  const btnStyle = (active = false): React.CSSProperties => ({
    background: 'transparent',
    border: `1px solid ${active ? 'var(--border-hi)' : 'var(--border)'}`,
    color: active ? 'var(--white)' : 'var(--dim)',
    fontFamily: 'var(--mono)',
    fontSize: '10px',
    padding: '3px 7px',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  });

  const resolutionLabel: Record<Resolution, string> = {
    carry: carryLabel.replace('CARRY ', 'CARRIED '),
    missed: 'MARKED MISSED',
    skip: 'SKIPPED',
    keep: 'KEPT UNPLANNED',
  };

  return (
    <div>
      {pendingTasks.map(task => {
        const res = resolved[task.id];
        const busy = loading[task.id];

        return (
          <div
            key={task.id}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div className="mono" style={{ fontSize: '12px', color: 'var(--body)', marginBottom: '6px' }}>
              {task.title}
            </div>

            {res ? (
              <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>
                — {resolutionLabel[res]}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => act(task.id, 'carry')}
                  disabled={busy}
                  style={btnStyle()}
                >
                  [{busy ? '...' : carryLabel}]
                </button>
                <button
                  onClick={() => act(task.id, 'missed')}
                  disabled={busy}
                  style={btnStyle()}
                >
                  [MARK MISSED]
                </button>
                <button
                  onClick={() => act(task.id, 'skip')}
                  disabled={busy}
                  style={btnStyle()}
                >
                  [SKIP]
                </button>
                <button
                  onClick={() => act(task.id, 'keep')}
                  disabled={busy}
                  style={btnStyle()}
                >
                  [KEEP UNPLANNED]
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
