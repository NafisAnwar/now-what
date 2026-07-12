import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import HabitRow from './HabitRow';
import HabitModal from './HabitModal';
import type { Habit } from '../../types';
import { getTodayStr } from '../../utils/dateUtils';

export default function HabitsPage() {
  const habits = useLiveQuery(() => db.habits.toArray());
  const [filter, setFilter] = useState<'ALL'|'DAILY'|'WEEKLY'|'CUSTOM'>('ALL');
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!habits) return null;

  const filtered = habits.filter(h => {
    if (filter === 'ALL') return true;
    if (filter === 'DAILY') return h.frequency === 'daily';
    if (filter === 'WEEKLY') return h.frequency === 'weekly';
    if (filter === 'CUSTOM') return h.frequency === 'custom';
    return true;
  });

  const handleComplete = async (habit: Habit, value?: number) => {
    const todayStr = getTodayStr();
    const now = new Date().toISOString();
    
    await db.habits.update(habit.id, {
      completionHistory: [...habit.completionHistory, { date: todayStr, value, completedAt: now }]
    });

    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'habit_completed',
      label: habit.name,
      relatedHabitId: habit.id,
      quantity: value,
      unit: habit.targetUnit,
      createdAt: now
    });

    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit completed.' }));
    window.dispatchEvent(new Event('regenerate_now_what'));
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="mono label" style={{ fontSize: '14px', color: 'var(--primary)' }}>
          HABITS
        </div>
        <button onClick={() => { setEditingHabit(undefined); setIsModalOpen(true); }} className="mono" style={{
          background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-hi)', padding: '6px 12px', fontSize: '10px', cursor: 'pointer'
        }}>
          [+ ADD HABIT]
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['ALL', 'DAILY', 'WEEKLY', 'CUSTOM'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="mono label" style={{
            background: filter === f ? 'var(--surface2)' : 'transparent',
            color: filter === f ? 'var(--primary)' : 'var(--dim)',
            border: '1px solid var(--border-hi)',
            padding: '4px 8px',
            cursor: 'pointer'
          }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        {filtered.map(habit => (
          <HabitRow
            key={habit.id}
            habit={habit}
            onComplete={(val) => handleComplete(habit, val)}
            onEdit={() => { setEditingHabit(habit); setIsModalOpen(true); }}
            onDelete={async () => {
              await db.habits.delete(habit.id);
              window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Habit deleted.' }));
            }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="mono" style={{ color: 'var(--dim)', padding: '24px 16px', fontSize: '12px' }}>
            No habits. Press H to add one.
          </div>
        )}
      </div>

      {isModalOpen && (
        <HabitModal
          habit={editingHabit}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
