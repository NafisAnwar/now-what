import { db } from './db';
import type { Workout, WorkoutExercise } from '../types';

export async function getWorkouts(): Promise<Workout[]> {
  const list = await db.workouts.toArray();
  return list.sort((a, b) => {
    // Sort descending by date, then by time or createdAt
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return (b.time || '').localeCompare(a.time || '');
  });
}

export async function getWorkoutsForDate(date: string): Promise<Workout[]> {
  const list = await db.workouts.where('date').equals(date).toArray();
  return list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export async function saveWorkout(data: {
  id?: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  exercises?: WorkoutExercise[];
  notes?: string;
  completed?: boolean;
}): Promise<Workout> {
  const now = new Date().toISOString();
  const id = data.id || crypto.randomUUID();

  const record: Workout = {
    id,
    title: data.title.trim(),
    date: data.date,
    time: data.time?.trim() || undefined,
    durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : undefined,
    exercises: data.exercises || [],
    notes: data.notes?.trim() || undefined,
    completed: Boolean(data.completed),
    createdAt: data.id ? (await db.workouts.get(id))?.createdAt || now : now,
    updatedAt: now,
  };

  await db.workouts.put(record);

  // Also log activity if marked completed
  if (record.completed) {
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'exercise',
      label: `Completed workout: ${record.title}`,
      durationMinutes: record.durationMinutes,
      createdAt: now,
    });
  }

  return record;
}

export async function toggleWorkoutCompleted(id: string): Promise<Workout | null> {
  const existing = await db.workouts.get(id);
  if (!existing) return null;

  const nextCompleted = !existing.completed;
  const now = new Date().toISOString();

  await db.workouts.update(id, {
    completed: nextCompleted,
    updatedAt: now,
  });

  if (nextCompleted) {
    await db.activityLogs.add({
      id: crypto.randomUUID(),
      type: 'exercise',
      label: `Completed workout: ${existing.title}`,
      durationMinutes: existing.durationMinutes,
      createdAt: now,
    });
  }

  return {
    ...existing,
    completed: nextCompleted,
    updatedAt: now,
  };
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
}
