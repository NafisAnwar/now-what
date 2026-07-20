import { db, PROFILE_SCHEMA_VERSION } from './db';
import { getActiveProfileRecord } from './profile';
import type { Settings } from '../types';
import { APP_VERSION } from '../constants/version';

export interface TutorialStatus {
  settings: Settings;
  shouldShowPrompt: boolean;
}

async function getOrCreateSettings(): Promise<Settings> {
  const existing = await db.settings.toArray() as Settings[];
  if (existing.length > 0) return existing[0];

  const profile = await getActiveProfileRecord();
  const now = new Date().toISOString();
  const settings: Settings = {
    id: crypto.randomUUID(),
    theme: 'dark',
    appVersion: APP_VERSION,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    localProfileId: profile?.id,
    createdAt: now,
    updatedAt: now,
  };

  await db.settings.add(settings as never);
  return settings;
}

function hasTutorialStatus(settings: Settings): boolean {
  return Boolean(
    settings.tutorialPromptSeenAt ||
    settings.tutorialCompletedAt ||
    settings.tutorialDismissedAt
  );
}

export async function getTutorialStatus(): Promise<TutorialStatus> {
  const settings = await getOrCreateSettings();
  return {
    settings,
    shouldShowPrompt: !hasTutorialStatus(settings),
  };
}

async function updateTutorialSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await getOrCreateSettings();
  await db.settings.update(settings.id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  } as never);
}

export async function markTutorialPromptSeen(): Promise<void> {
  const settings = await getOrCreateSettings();
  if (settings.tutorialPromptSeenAt) return;
  await updateTutorialSettings({ tutorialPromptSeenAt: new Date().toISOString() });
}

export async function markTutorialDismissed(): Promise<void> {
  const now = new Date().toISOString();
  await updateTutorialSettings({
    tutorialPromptSeenAt: now,
    tutorialDismissedAt: now,
  });
}

export async function markTutorialCompleted(): Promise<void> {
  const now = new Date().toISOString();
  await updateTutorialSettings({
    tutorialPromptSeenAt: now,
    tutorialCompletedAt: now,
  });
}
