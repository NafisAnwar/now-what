import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { saveWorkout } from '../../data/workouts';
import type { Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { getTodayStr } from '../../utils/dateUtils';

interface Props {
  initialWorkout?: Workout | null;
  onClose: () => void;
  onSaved?: (workout: Workout) => void;
}

export default function WorkoutModal({ initialWorkout, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initialWorkout?.title || '');
  const [date, setDate] = useState(initialWorkout?.date || getTodayStr());
  const [time, setTime] = useState(initialWorkout?.time || '');
  const [duration, setDuration] = useState(initialWorkout?.durationMinutes ? String(initialWorkout.durationMinutes) : '');
  const [notes, setNotes] = useState(initialWorkout?.notes || '');
  const [completed, setCompleted] = useState(initialWorkout?.completed || false);

  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    initialWorkout?.exercises && initialWorkout.exercises.length > 0
      ? initialWorkout.exercises
      : [
          {
            id: crypto.randomUUID(),
            name: '',
            sets: [{ id: crypto.randomUUID(), setNumber: 1, reps: 10, weightLbs: 0, completed: false }],
          },
        ]
  );

  const [saving, setSaving] = useState(false);

  const addExercise = () => {
    setExercises(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        sets: [{ id: crypto.randomUUID(), setNumber: 1, reps: 10, weightLbs: 0, completed: false }],
      },
    ]);
  };

  const removeExercise = (exId: string) => {
    setExercises(prev => prev.filter(e => e.id !== exId));
  };

  const updateExerciseName = (exId: string, name: string) => {
    setExercises(prev => prev.map(e => (e.id === exId ? { ...e, name } : e)));
  };

  const addSet = (exId: string) => {
    setExercises(prev =>
      prev.map(e => {
        if (e.id !== exId) return e;
        const nextSetNum = e.sets.length + 1;
        const lastSet = e.sets[e.sets.length - 1];
        const newSet: WorkoutSet = {
          id: crypto.randomUUID(),
          setNumber: nextSetNum,
          reps: lastSet?.reps ?? 10,
          weightLbs: lastSet?.weightLbs ?? 0,
          completed: false,
        };
        return { ...e, sets: [...e.sets, newSet] };
      })
    );
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises(prev =>
      prev.map(e => {
        if (e.id !== exId) return e;
        const filtered = e.sets.filter(s => s.id !== setId);
        return {
          ...e,
          sets: filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 })),
        };
      })
    );
  };

  const updateSet = (exId: string, setId: string, updates: Partial<WorkoutSet>) => {
    setExercises(prev =>
      prev.map(e => {
        if (e.id !== exId) return e;
        return {
          ...e,
          sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)),
        };
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    try {
      const saved = await saveWorkout({
        id: initialWorkout?.id,
        title: title.trim(),
        date,
        time: time.trim() || undefined,
        durationMinutes: duration ? parseInt(duration, 10) : undefined,
        exercises: exercises.filter(ex => ex.name.trim().length > 0),
        notes: notes.trim() || undefined,
        completed,
      });

      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Workout saved.' }));
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('[workout] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} ariaLabel={initialWorkout ? 'Edit Workout' : 'New Workout'}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mono" style={{ fontSize: '16px', color: 'var(--white)', letterSpacing: '0.05em' }}>
            {initialWorkout ? 'EDIT WORKOUT' : 'NEW WORKOUT'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mono"
            style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="mono label" style={{ display: 'block', marginBottom: '4px' }}>
            WORKOUT TITLE *
          </label>
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Leg Day, Push Workout, 5K Run"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--white)', padding: '8px 10px', fontSize: '14px' }}
          />
        </div>

        {/* Date, Time, Duration row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div>
            <label className="mono label" style={{ display: 'block', marginBottom: '4px' }}>
              DATE *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--white)', padding: '8px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label className="mono label" style={{ display: 'block', marginBottom: '4px' }}>
              TIME
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--white)', padding: '8px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label className="mono label" style={{ display: 'block', marginBottom: '4px' }}>
              DURATION (MIN)
            </label>
            <input
              type="number"
              min="1"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 45"
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--white)', padding: '8px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Completed toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <input
            type="checkbox"
            id="workout-completed"
            checked={completed}
            onChange={e => setCompleted(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="workout-completed" className="mono" style={{ fontSize: '12px', color: completed ? 'var(--primary)' : 'var(--body)', cursor: 'pointer' }}>
            MARK AS COMPLETED
          </label>
        </div>

        {/* Exercises Section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="mono label" style={{ fontSize: '13px', color: 'var(--white)' }}>
              EXERCISES ({exercises.length})
            </span>
            <button
              type="button"
              onClick={addExercise}
              className="mono"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--primary)', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
            >
              [+ ADD EXERCISE]
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {exercises.map((exercise, exIdx) => (
              <div
                key={exercise.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="mono" style={{ color: 'var(--dim)', fontSize: '12px' }}>
                    #{exIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={e => updateExerciseName(exercise.id, e.target.value)}
                    placeholder="Exercise name (e.g. Barbell Bench Press)"
                    style={{
                      flex: 1,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--white)',
                      padding: '6px 8px',
                      fontSize: '13px',
                    }}
                  />
                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExercise(exercise.id)}
                      className="mono"
                      title="Remove exercise"
                      style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sets header */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 40px 30px', gap: '6px', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>SET</span>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>WEIGHT (LBS)</span>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>REPS</span>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--dim)', textAlign: 'center' }}>DONE</span>
                  <span />
                </div>

                {/* Sets rows */}
                {exercise.sets.map(set => (
                  <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 40px 30px', gap: '6px', alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: '12px', color: 'var(--dim)', textAlign: 'center' }}>
                      {set.setNumber}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={set.weightLbs ?? ''}
                      onChange={e => updateSet(exercise.id, set.id, { weightLbs: e.target.value === '' ? undefined : Number(e.target.value) })}
                      placeholder="0"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--white)', padding: '4px 6px', fontSize: '12px' }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={set.reps ?? ''}
                      onChange={e => updateSet(exercise.id, set.id, { reps: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                      placeholder="0"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--white)', padding: '4px 6px', fontSize: '12px' }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={set.completed}
                        onChange={e => updateSet(exercise.id, set.id, { completed: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    {exercise.sets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSet(exercise.id, set.id)}
                        className="mono"
                        style={{ background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    ) : <span />}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addSet(exercise.id)}
                  className="mono"
                  style={{
                    alignSelf: 'flex-start',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dim)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '2px 0',
                    marginTop: '2px',
                  }}
                >
                  + Add set
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mono label" style={{ display: 'block', marginBottom: '4px' }}>
            NOTES
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Felt strong, increase bench next week…"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--white)', padding: '8px 10px', fontSize: '13px', resize: 'vertical' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            className="mono"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--dim)', padding: '8px 14px', cursor: 'pointer', fontSize: '12px' }}
          >
            [CANCEL]
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="mono"
            style={{
              background: 'var(--primary)',
              color: 'var(--bg)',
              border: 'none',
              padding: '8px 16px',
              cursor: title.trim() && !saving ? 'pointer' : 'not-allowed',
              opacity: title.trim() && !saving ? 1 : 0.5,
              fontSize: '12px',
            }}
          >
            {saving ? '[SAVING...]' : '[SAVE WORKOUT]'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
