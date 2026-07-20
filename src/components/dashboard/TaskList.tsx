import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import TaskRow from '../tasks/TaskRow';
import { Task } from '../../types';
import { completeTask } from '../../data/completions';

export default function TaskList() {
  const tasks = useLiveQuery(
    () => db.tasks.where('status').equals('pending').toArray()
  );

  if (!tasks) return <div className="mono label">LOADING...</div>;

  const handleComplete = async (task: Task) => {
    const completed = await completeTask(task.id);
    if (!completed) return;
    window.dispatchEvent(new Event('regenerate_now_what'));
    window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Task completed.' }));
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="label" style={{ marginBottom: '16px' }}>TODAY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onComplete={() => handleComplete(task)} />
        ))}
        {tasks.length === 0 && (
          <div className="mono label" style={{ color: 'var(--dim)', padding: '8px 0' }}>No tasks added.</div>
        )}
      </div>
      <button 
        onClick={() => {
          window.dispatchEvent(new Event('open_task_modal'));
        }}
        style={{
          marginTop: '16px',
          background: 'none',
          border: '1px solid var(--border-hi)',
          color: 'var(--dim)',
          width: '100%',
          padding: '8px',
          cursor: 'pointer',
          textAlign: 'center'
        }}
        className="mono"
      >
        + QUICK ADD
      </button>
    </div>
  );
}
