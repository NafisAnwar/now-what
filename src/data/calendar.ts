import type { CalendarBlock, Task } from '../types';
import { getTodayStr, localDateFromTimestamp, localDateStr } from '../utils/dateUtils';
import type { NowWhatDB } from './db';
import { parseIcsVevents, type IcsEvent } from './ics';

export type CalendarImportSource = 'ics' | 'google_ics' | 'apple_ics';

export interface ManualCalendarBlockInput {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  calendarName?: string;
}

export interface CalendarImportResult {
  imported: number;
  skipped: number;
  unsupportedRecurrenceCount: number;
}

export interface ConvertCalendarBlockResult {
  task: Task;
  created: boolean;
}

export class CalendarImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarImportError';
  }
}

function sortBlocks(blocks: CalendarBlock[]): CalendarBlock[] {
  return [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

function toBlockRange(input: ManualCalendarBlockInput): Pick<CalendarBlock, 'startAt' | 'endAt'> {
  return {
    startAt: input.date + (input.startTime ? `T${input.startTime}:00` : 'T00:00:00'),
    endAt: input.date + (input.endTime ? `T${input.endTime}:00` : 'T23:59:00'),
  };
}

function isValidLocalDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function isValidTime(value: string | undefined): boolean {
  if (!value) return true;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function validateManualCalendarBlockInput(input: ManualCalendarBlockInput): string | null {
  if (!input.title.trim()) return 'Calendar block title is required.';
  if (!isValidLocalDate(input.date)) return 'Calendar block date is invalid.';
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return 'Calendar block time is invalid.';
  }
  if (input.startTime && input.endTime && input.endTime <= input.startTime) {
    return 'End time must be after start time.';
  }
  return null;
}

export function calendarBlockOverlapsDate(block: Pick<CalendarBlock, 'startAt' | 'endAt'>, date: string): boolean {
  if (!isValidLocalDate(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const dayStart = new Date(year, month - 1, day).getTime();
  const dayEnd = new Date(year, month - 1, day + 1).getTime();
  const start = new Date(block.startAt).getTime();
  const end = new Date(block.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  if (start === end) return start >= dayStart && start < dayEnd;
  return start < dayEnd && end > dayStart;
}

export function isAllDayCalendarBlock(block: Pick<CalendarBlock, 'startAt' | 'endAt'>): boolean {
  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const startsAtMidnight = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
  const endsAtDayBoundary =
    (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end > start) ||
    (end.getHours() === 23 && end.getMinutes() === 59);
  return startsAtMidnight && endsAtDayBoundary;
}

function dedupeKey(block: Pick<CalendarBlock, 'source' | 'externalId' | 'title' | 'startAt' | 'endAt'>): string {
  if (block.externalId) return `${block.source}:external:${block.externalId}`;
  return `${block.source}:fallback:${block.title}:${block.startAt}:${block.endAt}`;
}

export async function getCalendarBlocksForDate(database: NowWhatDB, date: string): Promise<CalendarBlock[]> {
  const blocks = await database.calendarBlocks.filter(block => calendarBlockOverlapsDate(block, date)).toArray();
  return sortBlocks(blocks);
}

export function getTodaysCalendarBlocks(database: NowWhatDB): Promise<CalendarBlock[]> {
  return getCalendarBlocksForDate(database, getTodayStr());
}

export async function getUpcomingCalendarBlocks(database: NowWhatDB, days: number): Promise<CalendarBlock[]> {
  const todayStr = getTodayStr();
  const endStr = localDateStr(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  const blocks = await database.calendarBlocks
    .filter(block => {
      const blockDate = localDateFromTimestamp(block.startAt);
      return blockDate > todayStr && blockDate <= endStr;
    })
    .toArray();

  return sortBlocks(blocks);
}

export async function createManualCalendarBlock(database: NowWhatDB, input: ManualCalendarBlockInput): Promise<CalendarBlock> {
  const validationError = validateManualCalendarBlockInput(input);
  if (validationError) throw new Error(validationError);
  const now = new Date().toISOString();
  const range = toBlockRange(input);
  const block: CalendarBlock = {
    id: crypto.randomUUID(),
    source: 'manual',
    title: input.title.trim(),
    startAt: range.startAt,
    endAt: range.endAt,
    location: input.location?.trim() || undefined,
    calendarName: input.calendarName?.trim() || undefined,
    convertedTaskIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await database.calendarBlocks.add(block);
  return block;
}

export async function updateCalendarBlock(
  database: NowWhatDB,
  id: string,
  patch: Partial<Omit<CalendarBlock, 'id' | 'source' | 'externalId' | 'createdAt'>>
): Promise<void> {
  await database.calendarBlocks.update(id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCalendarBlock(database: NowWhatDB, id: string): Promise<void> {
  await database.calendarBlocks.delete(id);
}

export function normalizeExternalEventToBlock(
  event: IcsEvent,
  source: CalendarImportSource = 'ics',
  importedAt = new Date().toISOString()
): CalendarBlock {
  return {
    id: crypto.randomUUID(),
    source,
    externalId: event.uid || undefined,
    title: event.title.trim() || 'Untitled',
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location || undefined,
    importedAt,
    convertedTaskIds: [],
    createdAt: importedAt,
    updatedAt: importedAt,
  };
}

export async function dedupeCalendarBlocks(
  database: NowWhatDB,
  blocks: CalendarBlock[]
): Promise<{ blocks: CalendarBlock[]; skipped: number }> {
  const existing = await database.calendarBlocks.toArray();
  const seen = new Set(existing.map(dedupeKey));
  const uniqueBlocks: CalendarBlock[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const key = dedupeKey(block);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    uniqueBlocks.push(block);
  }

  return { blocks: uniqueBlocks, skipped };
}

export async function importIcsFile(database: NowWhatDB, file: File): Promise<CalendarImportResult> {
  const text = await file.text();
  const parsed = parseIcsVevents(text);

  if (parsed.events.length === 0) {
    throw new CalendarImportError('No events found in file.');
  }

  const importedAt = new Date().toISOString();
  const candidateBlocks = parsed.events.map(event => normalizeExternalEventToBlock(event, 'ics', importedAt));
  const { blocks, skipped } = await dedupeCalendarBlocks(database, candidateBlocks);

  if (blocks.length > 0) {
    await database.calendarBlocks.bulkAdd(blocks as never);
  }

  return {
    imported: blocks.length,
    skipped,
    unsupportedRecurrenceCount: parsed.unsupportedRecurrenceCount,
  };
}

export async function convertCalendarBlockToTask(
  database: NowWhatDB,
  blockId: string
): Promise<ConvertCalendarBlockResult> {
  return database.transaction('rw', database.tasks, database.calendarBlocks, async () => {
    const block = await database.calendarBlocks.get(blockId);
    if (!block) throw new Error('Calendar block not found.');

    for (const taskId of block.convertedTaskIds || []) {
      const existingTask = await database.tasks.get(taskId);
      if (existingTask) return { task: existingTask, created: false };
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: block.title,
      category: 'Admin',
      priority: 'medium',
      status: 'pending',
      energyRequired: 'medium',
      dueDate: localDateFromTimestamp(block.startAt),
      repeatRule: { type: 'none' },
      notes: `Created from calendar block ${block.id}.`,
      missedCount: 0,
      carryOverHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    await database.tasks.add(task);
    await database.calendarBlocks.update(block.id, {
      convertedTaskIds: [...(block.convertedTaskIds || []), task.id],
      updatedAt: now,
    });
    return { task, created: true };
  });
}
