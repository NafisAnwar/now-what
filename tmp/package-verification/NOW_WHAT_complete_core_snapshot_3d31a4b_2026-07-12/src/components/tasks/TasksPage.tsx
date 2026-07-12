import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import TaskRow from './TaskRow';
import { Task } from '../../types';

export default function TasksPage() {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE'>('PENDING');

  const tasks = useLiveQuery(
    () => {
      if (filter === 'ALL') return db.tasks.toArray();
      return db.tasks.where('status').equals(filter.toLowerCase()).toArray();
    },
    [filter]
  );

  const handleComplete = async (task: Task) => {
    await db.tasks.update(task.id, { 
      status: 'complete', 
      completedAt: new Date().toISOString() 
    });
    
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'task_completed',
      label: task.title,
      relatedTaskId: task.id,
      createdAt: new Date().toISOString()
    });

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
          <TaskRow key={task.id} task={task} onComplete={task.status === 'pending' ? () => handleComplete(task) : undefined} />
        ))}
      </div>
    </div>
  );
}
