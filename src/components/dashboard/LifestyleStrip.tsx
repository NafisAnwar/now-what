import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { getTodayStr, isLocalDate } from '../../utils/dateUtils';

export default function LifestyleStrip() {
  const todayStr = getTodayStr();
  
  const logs = useLiveQuery(
    () => db.activityLogs.filter(l => isLocalDate(l.createdAt, todayStr)).toArray()
  );

  if (!logs) return null;

  const waterMl = logs.filter(l => l.type === 'water').reduce((acc, l) => acc + (l.quantity || 0), 0);
  const focusMin = logs.filter(l => l.type === 'focus').reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const mealsCount = logs.filter(l => l.type === 'meal').length;
  const movementMin = logs.filter(l => l.type === 'exercise').reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const restMin = logs.filter(l => l.type === 'rest').reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const distractionMin = logs.filter(l => l.type === 'distraction').reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  
  const energyLogs = logs
    .filter(l => l.type === 'energy' || l.type === 'state_check')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestEnergy = energyLogs[0];
  const energyLevel = latestEnergy?.type === 'state_check' ? latestEnergy.energyLevel : latestEnergy?.quantity;
  const energyVal = typeof energyLevel === 'number' ? `${energyLevel}/5` : '—';

  const stateLogs = logs.filter(l => l.type === 'state_check').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stateVal = stateLogs[0]?.state?.toUpperCase() ?? '—';
  
  const moodLogs = logs.filter(l => l.type === 'mood').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const moodVal = moodLogs.length > 0 ? `${moodLogs[0].quantity}/5` : '—';

  const metrics = [
    { label: 'WATER', value: waterMl ? `${waterMl}ml` : '0ml' },
    { label: 'FOCUS', value: focusMin ? `${focusMin}m` : '0m' },
    { label: 'MEALS', value: `${mealsCount}` },
    { label: 'MOVEMENT', value: movementMin ? `${movementMin}m` : '0m' },
    { label: 'STATE', value: stateVal },
    { label: 'ENERGY', value: energyVal },
    { label: 'MOOD', value: moodVal },
    { label: 'REST', value: restMin ? `${restMin}m` : '0m' },
    { label: 'DISTRACTION', value: distractionMin ? `${distractionMin}m` : '0m' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '24px',
      rowGap: '12px',
      overflowX: 'auto',
      paddingBottom: '16px',
      marginBottom: '32px',
      borderBottom: '1px solid var(--border)'
    }}>
      {metrics.map((m, i) => (
        <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <span className="mono label" style={{ fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
          <span className="mono" style={{ fontSize: '14px', color: 'var(--secondary)' }}>{m.value}</span>
        </div>
      ))}
    </div>
  );
}
