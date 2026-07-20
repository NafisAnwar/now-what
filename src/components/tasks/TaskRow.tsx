import React from 'react';
import { Task } from '../../types';

export default function TaskRow({ task, onComplete, goalTitle }: { task: Task, onComplete?: () => void, goalTitle?: string }) {
  const isComplete = task.status === 'complete';

  return (
    <div className="task-row" data-task-id={task.id} style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      opacity: isComplete ? 0.5 : 1
    }}>
      <button 
        onClick={onComplete}
        disabled={isComplete}
        aria-label={isComplete ? `${task.title} completed` : `Complete ${task.title}`}
        style={{
          width: '16px',
          height: '16px',
          border: '1px solid var(--border-hi)',
          background: isComplete ? 'var(--primary)' : 'transparent',
          marginRight: '12px',
          cursor: isComplete ? 'default' : 'pointer',
          flexShrink: 0
        }}
      />
      <div className="task-row-main" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ 
          color: isComplete ? 'var(--dim)' : 'var(--body)',
          textDecoration: isComplete ? 'line-through' : 'none',
          fontSize: '14px'
        }}>
          {task.title}
        </span>
        <span className="mono" style={{ 
          fontSize: '10px', 
          color: 'var(--dim)',
          padding: '2px 4px',
          backgroundColor: 'var(--surface2)',
          border: '1px solid var(--border-mid)'
        }}>
          {task.priority === 'critical' ? 'CRIT' : task.priority.toUpperCase()}
        </span>
        {goalTitle && (
          <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', padding: '2px 4px', border: '1px solid var(--border)' }}>
            GOAL: {goalTitle.length > 16 ? goalTitle.substring(0, 16).toUpperCase() + '…' : goalTitle.toUpperCase()}
          </span>
        )}
      </div>
      {(task.dueDate || task.estimatedMinutes) && (
        <div className="task-row-details" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {task.dueDate && (
            <div className="mono" style={{ color: 'var(--dim)', fontSize: '11px' }}>
              DUE {task.dueDate}
            </div>
          )}
          {task.estimatedMinutes && (
            <div className="mono" style={{ color: 'var(--dim)', fontSize: '12px' }}>
              {task.estimatedMinutes}m
            </div>
          )}
        </div>
      )}
    </div>
  );
}
