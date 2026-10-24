import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { deleteWorkout, toggleWorkoutCompleted } from '../../data/workouts';
import WorkoutModal from './WorkoutModal';
import type { Workout } from '../../types';
import { getTodayStr } from '../../utils/dateUtils';

type FilterType = 'ALL' | 'TODAY' | 'COMPLETED' | 'PLANNED';

export default function WorkoutsPage() {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({});

  const todayStr = getTodayStr();

  const workouts = useLiveQuery(async () => {
    let list: Workout[] = [];
    if (filter === 'ALL') {
      list = await db.workouts.toArray();
    } else if (filter === 'TODAY') {
      list = await db.workouts.where('date').equals(todayStr).toArray();
    } else if (filter === 'COMPLETED') {
      list = (await db.workouts.toArray()).filter(w => w.completed);
    } else if (filter === 'PLANNED') {
      list = (await db.workouts.toArray()).filter(w => !w.completed);
    }

    return list.sort((a, b) => {
      const comp = b.date.localeCompare(a.date);
      if (comp !== 0) return comp;
      return (b.time || '').localeCompare(a.time || '');
    });
  }, [filter, todayStr]);

  const toggleExpand = (id: string) => {
    setExpandedWorkoutIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleComplete = async (workout: Workout) => {
    await toggleWorkoutCompleted(workout.id);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this workout?')) {
      await deleteWorkout(id);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Workout deleted.' }));
    }
  };

  const handleOpenNew = () => {
    setEditingWorkout(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setIsModalOpen(true);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="mono" style={{ fontSize: '24px', color: 'var(--white)', letterSpacing: '0.05em', fontWeight: 'normal', margin: 0 }}>
            WORKOUTS
          </h1>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>
            Track exercises, sets, reps, and routines
          </div>
        </div>
        <button
          onClick={handleOpenNew}
          className="mono"
          style={{
            background: 'var(--primary)',
            color: 'var(--bg)',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          [+ LOG WORKOUT]
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        {(['ALL', 'TODAY', 'COMPLETED', 'PLANNED'] as FilterType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="mono"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: filter === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: filter === tab ? 'var(--primary)' : 'var(--dim)',
              padding: '8px 0',
              cursor: 'pointer',
              fontSize: '12px',
              marginBottom: '-1px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!workouts && <div className="mono label">LOADING...</div>}

        {workouts && workouts.length === 0 && (
          <div
            style={{
              border: '1px dashed var(--border)',
              padding: '32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div className="mono" style={{ color: 'var(--dim)', fontSize: '13px' }}>
              No workouts found in this view.
            </div>
            <button
              onClick={handleOpenNew}
              className="mono"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              [+ ADD FIRST WORKOUT]
            </button>
          </div>
        )}

        {workouts &&
          workouts.map(workout => {
            const isExpanded = Boolean(expandedWorkoutIds[workout.id]);
            const totalSets = workout.exercises?.reduce((sum, e) => sum + (e.sets?.length || 0), 0) || 0;

            return (
              <div
                key={workout.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={workout.completed}
                      onChange={() => handleToggleComplete(workout)}
                      title={workout.completed ? 'Mark incomplete' : 'Mark complete'}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: '15px',
                          color: workout.completed ? 'var(--dim)' : 'var(--white)',
                          textDecoration: workout.completed ? 'line-through' : 'none',
                          fontWeight: 500,
                        }}
                      >
                        {workout.title}
                      </div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '2px' }}>
                        {workout.date}
                        {workout.time ? ` at ${workout.time}` : ''}
                        {workout.durationMinutes ? ` • ${workout.durationMinutes} min` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        border: '1px solid var(--border)',
                        color: workout.completed ? 'var(--primary)' : 'var(--dim)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {workout.completed ? 'DONE' : 'PLANNED'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(workout)}
                      className="mono"
                      style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '12px' }}
                      title="Edit workout"
                    >
                      [EDIT]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(workout.id)}
                      className="mono"
                      style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '12px' }}
                      title="Delete workout"
                    >
                      [DEL]
                    </button>
                  </div>
                </div>

                {/* Sub row summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
                    {workout.exercises?.length || 0} exercises • {totalSets} sets
                  </div>
                  {workout.exercises && workout.exercises.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(workout.id)}
                      className="mono"
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}
                    >
                      {isExpanded ? '[-] HIDE DETAILS' : '[+] SHOW DETAILS'}
                    </button>
                  )}
                </div>

                {/* Expanded exercise details */}
                {isExpanded && workout.exercises && workout.exercises.length > 0 && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {workout.exercises.map((ex, idx) => (
                      <div key={ex.id || idx} style={{ background: 'var(--bg)', padding: '8px 10px', border: '1px solid var(--border)' }}>
                        <div className="mono" style={{ fontSize: '12px', color: 'var(--white)', fontWeight: 600, marginBottom: '4px' }}>
                          {idx + 1}. {ex.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {ex.sets?.map(set => (
                            <span
                              key={set.id || set.setNumber}
                              className="mono"
                              style={{
                                fontSize: '11px',
                                color: set.completed ? 'var(--primary)' : 'var(--body)',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                padding: '2px 6px',
                              }}
                            >
                              S{set.setNumber}: {set.weightLbs ? `${set.weightLbs}lbs × ` : ''}{set.reps || 0}r
                              {set.completed ? ' ✓' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {workout.notes && (
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', fontStyle: 'italic', marginTop: '4px' }}>
                        Notes: {workout.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <WorkoutModal
          initialWorkout={editingWorkout}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
