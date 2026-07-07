import { db } from './db';
import type { Task, ActivityLog } from '../types';
import { getTodayStr, getYesterdayStr } from '../utils/dateUtils';

const MANUAL_CLEAR_KEY = 'nowwhat_manual_clear';

export async function seedIfEmpty() {
  // If the user explicitly cleared data, do not auto-seed on reload
  if (localStorage.getItem(MANUAL_CLEAR_KEY) === '1') return;

  const count = await db.tasks.count();
  if (count > 0) return; // already seeded or has real data

  await _seed();
}

export async function reseedWithDemoData() {
  // Remove the manual-clear guard so future reloads can seed again
  localStorage.removeItem(MANUAL_CLEAR_KEY);
  await _seed();
}

async function _seed() {
  const now = new Date().toISOString();
  const today = getTodayStr();
  const yesterday = getYesterdayStr();

  const tasks: Task[] = [
    {
      id: crypto.randomUUID(),
      title: 'Submit assignment draft',
      category: 'School',
      priority: 'critical',
      status: 'pending',
      estimatedMinutes: 90,
      dueDate: yesterday, // overdue — triggers NOW_WHAT? critical rule
      repeatRule: { type: 'none' },
      energyRequired: 'high',
      missedCount: 1,
      carryOverHistory: [yesterday],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Review meeting notes',
      category: 'Work',
      priority: 'high',
      status: 'pending',
      estimatedMinutes: 20,
      dueDate: today,
      repeatRule: { type: 'none' },
      energyRequired: 'low',
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Reply to email backlog',
      category: 'Admin',
      priority: 'medium',
      status: 'pending',
      estimatedMinutes: 30,
      dueDate: today,
      repeatRule: { type: 'none' },
      energyRequired: 'low',
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: '30-min walk',
      category: 'Health',
      priority: 'medium',
      status: 'pending',
      estimatedMinutes: 30,
      repeatRule: { type: 'daily' },
      energyRequired: 'medium',
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Read 10 pages',
      category: 'Personal',
      priority: 'low',
      status: 'pending',
      estimatedMinutes: 15,
      repeatRule: { type: 'daily' },
      energyRequired: 'low',
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Fix failing unit tests',
      category: 'Work',
      priority: 'high',
      status: 'complete',
      estimatedMinutes: 45,
      repeatRule: { type: 'none' },
      energyRequired: 'high',
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
      completedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const logs: ActivityLog[] = [
    {
      id: crypto.randomUUID(),
      type: 'task_completed',
      label: 'Fix failing unit tests',
      relatedTaskId: tasks[5].id,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: 'water',
      label: 'Water — 500ml',
      quantity: 500,
      unit: 'ml',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: 'focus',
      label: 'Focus session — 45 min',
      durationMinutes: 45,
      createdAt: new Date(Date.now() - 5400000).toISOString(),
    },
  ];

  await db.tasks.bulkAdd(tasks);
  await db.activityLogs.bulkAdd(logs);
}
