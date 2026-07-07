import { db } from '../data/db';
import type { DailyPlan } from '../types';
import { getTodayStr } from '../utils/dateUtils';

export async function getOrCreateTodaysPlan(): Promise<DailyPlan> {
  const todayStr = getTodayStr();
  const existing = await db.dailyPlans.where('date').equals(todayStr).first();
  if (existing) return existing;
  const now = new Date().toISOString();
  const plan: DailyPlan = {
    id: crypto.randomUUID(),
    date: todayStr,
    primaryFocus: undefined,
    plannedTaskIds: [],
    plannedHabitIds: [],
    calendarBlockIds: [],
    lifestyleMinimums: {},
    carryOverTaskIds: [],
    reviewStatus: 'not_started',
    createdAt: now,
    updatedAt: now,
  };
  await db.dailyPlans.add(plan);
  return plan;
}

export async function setTodaysPrimaryFocus(planId: string, focus: string): Promise<void> {
  await db.dailyPlans.update(planId, { primaryFocus: focus || undefined, updatedAt: new Date().toISOString() });
}

export async function addTaskToPlan(planId: string, taskId: string, currentIds: string[]): Promise<void> {
  if (currentIds.includes(taskId)) return;
  await db.dailyPlans.update(planId, { plannedTaskIds: [...currentIds, taskId], updatedAt: new Date().toISOString() });
}

export async function removeTaskFromPlan(planId: string, taskId: string, currentIds: string[]): Promise<void> {
  await db.dailyPlans.update(planId, { plannedTaskIds: currentIds.filter(id => id !== taskId), updatedAt: new Date().toISOString() });
}

export async function addHabitToPlan(planId: string, habitId: string, currentIds: string[]): Promise<void> {
  if (currentIds.includes(habitId)) return;
  await db.dailyPlans.update(planId, { plannedHabitIds: [...currentIds, habitId], updatedAt: new Date().toISOString() });
}

export async function removeHabitFromPlan(planId: string, habitId: string, currentIds: string[]): Promise<void> {
  await db.dailyPlans.update(planId, { plannedHabitIds: currentIds.filter(id => id !== habitId), updatedAt: new Date().toISOString() });
}

export async function addCalendarBlockToPlan(planId: string, blockId: string, currentIds: string[]): Promise<void> {
  const ids = currentIds ?? [];
  if (ids.includes(blockId)) return;
  await db.dailyPlans.update(planId, { calendarBlockIds: [...ids, blockId], updatedAt: new Date().toISOString() });
}

export async function removeCalendarBlockFromPlan(planId: string, blockId: string, currentIds: string[]): Promise<void> {
  const ids = currentIds ?? [];
  await db.dailyPlans.update(planId, { calendarBlockIds: ids.filter(id => id !== blockId), updatedAt: new Date().toISOString() });
}

export async function carryOverTask(planId: string, taskId: string, currentCarryOverIds: string[], currentPlannedIds: string[]): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const todayStr = getTodayStr();
  const newCarryOver = currentCarryOverIds.includes(taskId) ? currentCarryOverIds : [...currentCarryOverIds, taskId];
  const newPlanned = currentPlannedIds.includes(taskId) ? currentPlannedIds : [...currentPlannedIds, taskId];
  const prevHistory = task.carryOverHistory || [];
  const newHistory = prevHistory.includes(todayStr) ? prevHistory : [...prevHistory, todayStr];
  await db.tasks.update(taskId, {
    carryOverHistory: newHistory,
    missedCount: prevHistory.includes(todayStr) ? (task.missedCount || 0) : (task.missedCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  await db.dailyPlans.update(planId, {
    carryOverTaskIds: newCarryOver,
    plannedTaskIds: newPlanned,
    updatedAt: new Date().toISOString(),
  });
}
