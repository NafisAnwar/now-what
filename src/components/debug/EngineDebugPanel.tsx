import React from 'react';
import type { Context, CandidateAction } from '../../engine/nowWhat';
import type { Suggestion } from '../../types';

interface EngineDebugPanelProps {
  context: Context | null;
  candidates: CandidateAction[];
  suggestion: Suggestion | null;
  onClose: () => void;
}

export default function EngineDebugPanel({ context, candidates, suggestion, onClose }: EngineDebugPanelProps) {
  if (!context) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      width: '320px',
      maxHeight: '400px',
      overflowY: 'auto',
      background: 'var(--surface)',
      border: '1px solid var(--border-hi)',
      padding: '16px',
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono label" style={{ color: 'var(--primary)' }}>ENGINE DEBUG</div>
        <button onClick={onClose} className="mono label" style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>
          [X]
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="mono label" style={{ color: 'var(--white)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>CONTEXT</div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div>Pending tasks: <span style={{ color: 'var(--secondary)' }}>{context.pendingTasks.length}</span></div>
          <div>Total tasks: <span style={{ color: 'var(--secondary)' }}>{context.totalTaskCount}</span></div>
          <div>Overdue: <span style={{ color: 'var(--secondary)' }}>{context.criticalOverdueTasks.length}</span></div>
          <div>Incomplete habits: <span style={{ color: 'var(--secondary)' }}>{context.pendingHabitsAny.length}</span></div>
          <div>Total habits: <span style={{ color: 'var(--secondary)' }}>{context.totalHabitCount}</span></div>
          <div>Calendar blocks: <span style={{ color: 'var(--secondary)' }}>{context.totalCalendarBlockCount}</span></div>
          <div>Has context: <span style={{ color: 'var(--secondary)' }}>{context.hasUserContext ? 'yes' : 'no'}</span></div>
          <div>Reviewable today: <span style={{ color: 'var(--secondary)' }}>{context.hasReviewableActivityToday ? 'yes' : 'no'}</span></div>
          <div>Cooldowns: <span style={{ color: 'var(--secondary)' }}>{context.activeCooldownCount}</span></div>
          <div>State: <span style={{ color: 'var(--secondary)' }}>{context.latestMoodState}</span></div>
          <div>Energy level: <span style={{ color: 'var(--secondary)' }}>{context.latestEnergyLevel || 'â€”'}</span></div>
          <div>Capacity: <span style={{ color: 'var(--secondary)' }}>{context.currentFocusCapacity}</span></div>
          <div>Energy: <span style={{ color: 'var(--secondary)' }}>{context.lastEnergyValue !== null ? `${context.lastEnergyValue}/5` : '—'}</span></div>
          <div>Mood: <span style={{ color: 'var(--secondary)' }}>{context.lastMoodValue !== null ? `${context.lastMoodValue}/5` : '—'}</span></div>
          <div>Water today: <span style={{ color: 'var(--secondary)' }}>{context.waterMlToday}ml</span></div>
          <div>Last water: <span style={{ color: 'var(--secondary)' }}>{context.minutesSinceLastWater === Infinity ? 'never' : `${Math.round(context.minutesSinceLastWater)} min ago`}</span></div>
          <div>Focus today: <span style={{ color: 'var(--secondary)' }}>{context.focusMinutesToday}m</span></div>
          <div>Last focus: <span style={{ color: 'var(--secondary)' }}>{context.minutesSinceLastFocus === Infinity ? 'never' : `${Math.round(context.minutesSinceLastFocus)} min ago`}</span></div>
          <div>Rest today: <span style={{ color: 'var(--secondary)' }}>{context.restMinutesToday}m</span></div>
          <div>Movement today: <span style={{ color: 'var(--secondary)' }}>{context.movementMinutesToday}m</span></div>
          <div>Distraction today: <span style={{ color: 'var(--secondary)' }}>{context.distractionMinutesToday}m</span></div>
          <div>Hour: <span style={{ color: 'var(--secondary)' }}>{context.hour}</span></div>
          <div>Goals active: <span style={{ color: 'var(--secondary)' }}>{context.activeGoals?.length ?? 0}</span></div>
          <div>Planned tasks: <span style={{ color: 'var(--secondary)' }}>{context.plannedTaskIds?.length ?? 0}</span></div>
          <div>Primary focus: <span style={{ color: 'var(--secondary)' }}>{context.primaryFocus || '—'}</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="mono label" style={{ color: 'var(--white)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>CANDIDATES</div>
        {candidates.map((c, i) => (
          <div key={i} className="mono" style={{ 
            fontSize: '10px', 
            color: c.identity === context.selectedCandidateIdentity ? 'var(--primary)' : 'var(--dim)',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{ minWidth: '28px' }}>{Number.isInteger(c.priority) ? c.priority : c.priority.toFixed(2)}.</span>
            <span>{c.ruleName}</span>
            <span style={{ opacity: 0.5 }}>({c.actionType})</span>
            {c.identity && <span style={{ opacity: 0.55 }}>{c.identity}</span>}
            {c.stateAffected && (
              <span style={{ opacity: 0.7 }}>
                state {c.stateAdjustment && c.stateAdjustment > 0 ? '+' : ''}{c.stateAdjustment?.toFixed(1)}
              </span>
            )}
            {c.cooldownReason && <span style={{ opacity: 0.7 }}>cooldown</span>}
          </div>
        ))}
      </div>

      {suggestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mono label" style={{ color: 'var(--white)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>SELECTED</div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--secondary)' }}>
            <div><span style={{ color: 'var(--dim)' }}>CMD:</span> {suggestion.command}</div>
            <div><span style={{ color: 'var(--dim)' }}>LBL:</span> {suggestion.targetLabel}</div>
            <div><span style={{ color: 'var(--dim)' }}>ID:</span> {context.selectedCandidateIdentity || 'none'}</div>
            <div><span style={{ color: 'var(--dim)' }}>STATE:</span> {candidates[0]?.stateAffected ? 'affected' : 'not applied'}</div>
            <div><span style={{ color: 'var(--dim)' }}>RSN:</span> {suggestion.reason.length > 60 ? suggestion.reason.substring(0, 60) + '...' : suggestion.reason}</div>
            {context.excludedCandidateIdentities.length > 0 && (
              <div><span style={{ color: 'var(--dim)' }}>EXCL:</span> {context.excludedCandidateIdentities.join(', ')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
