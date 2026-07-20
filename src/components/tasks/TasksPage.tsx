import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import TaskRow from './TaskRow';
import { Task } from '../../types';
import { completeTask } from '../../data/completions';

export default function TasksPage() {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE'>('PENDING');

  const tasks = useLiveQuery(
    () => {
      if (filter === 'ALL') return db.tasks.toArray();
      return db.tasks.where('status').equals(filter.toLowerCase()).toArray();
    },
    [filter]
  );
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];

  useEffect(() => {
    if (!tasks) return;
    const taskId = sessionStorage.getItem('nowwhat:focus-task');
    if (!taskId) return;
    sessionStorage.removeItem('nowwhat:focus-task');
    window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(taskId)}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    });
  }, [tasks]);

  const handleComplete = async (task: Task) => {
    const completed = await completeTask(task.id);
    if (!completed) return;
    window.dispatchEvent(new Event('regenerate_now_what'));
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Task completed.' }));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div className="mono" style={{ fontSize: '24px', color: 'var(--white)', letterSpacing: '0.05em' }}>TASKS</div>
        <button
          onClick={() => window.dispatchEvent(new Event('open_task_modal'))}
          className="mono"
          style={{
            background: 'var(--primary)',
            color: 'var(--bg)',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          [+ ADD TASK]
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {['ALL', 'PENDING', 'COMPLETE'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className="mono"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: filter === f ? '2px solid var(--primary)' : '2px solid transparent',
              color: filter === f ? 'var(--primary)' : 'var(--dim)',
              padding: '8px 0',
              cursor: 'pointer',
              fontSize: '12px',
              marginBottom: '-1px'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!tasks && <div className="mono label">LOADING...</div>}
        {tasks && tasks.length === 0 && <div className="mono label">No tasks found</div>}
        {tasks && tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            goalTitle={goals.find(goal => goal.id === task.goalId)?.title}
            onComplete={task.status === 'pending' ? () => handleComplete(task) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
