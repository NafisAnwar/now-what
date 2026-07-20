import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import GoalRow from './GoalRow';
import GoalModal from './GoalModal';
import type { Goal } from '../../types';
import { useTodayStr } from '../../utils/dateUtils';

export default function GoalsPage() {
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const pendingTasks = useLiveQuery(() => db.tasks.where('status').equals('pending').toArray(), []) || [];
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) || [];

  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETE'>('ALL');
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayStr = useTodayStr();

  if (!goals) return null;

  const filtered = goals.filter(g => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return g.status === 'active';
    if (filter === 'PAUSED') return g.status === 'paused';
    if (filter === 'COMPLETE') return g.status === 'complete';
    return true;
  });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="mono label" style={{ fontSize: '14px', color: 'var(--primary)' }}>
          GOALS
        </div>
        <button
          onClick={() => { setEditingGoal(undefined); setIsModalOpen(true); }}
          className="mono"
          style={{
            background: 'transparent', color: 'var(--primary)',
            border: '1px solid var(--border-hi)', padding: '6px 12px',
            fontSize: '10px', cursor: 'pointer',
          }}
        >
          [+ ADD GOAL]
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['ALL', 'ACTIVE', 'PAUSED', 'COMPLETE'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="mono label" style={{
            background: filter === f ? 'var(--surface2)' : 'transparent',
            color: filter === f ? 'var(--primary)' : 'var(--dim)',
            border: '1px solid var(--border-hi)',
            padding: '4px 8px',
            cursor: 'pointer',
          }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        {filtered.map(goal => (
          <GoalRow
            key={goal.id}
            goal={goal}
            pendingTasks={pendingTasks}
            allTasks={allTasks}
            habits={allHabits}
            todayStr={todayStr}
            onEdit={() => { setEditingGoal(goal); setIsModalOpen(true); }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="mono" style={{ color: 'var(--dim)', padding: '24px 16px', fontSize: '12px' }}>
            No goals. Press G to add one.
          </div>
        )}
      </div>

      {isModalOpen && (
        <GoalModal
          goal={editingGoal}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
