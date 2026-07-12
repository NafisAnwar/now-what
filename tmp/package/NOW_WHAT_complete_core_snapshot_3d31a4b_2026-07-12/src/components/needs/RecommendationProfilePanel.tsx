import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  NEEDS_PROFILE_ID,
  scheduleNextStateCheck,
  updateNeedsProfile,
} from '../../data/needsProfile';
import type {
  LowEnergyPreference,
  NeedType,
  PriorityMode,
} from '../../types';

interface Props {
  onSaved?: () => void;
  onCancel?: () => void;
}

const NEED_OPTIONS: Array<{
  value: NeedType;
  code: string;
  label: string;
  description: string;
}> = [
  {
    value: 'school_work',
    code: '[SW]',
    label: 'School / Work Execution',
    description: 'Assignments, deadlines, study blocks, work tasks.',
  },
  {
    value: 'habit_consistency',
    code: '[HC]',
    label: 'Habit Consistency',
    description: 'Routines, repeated actions, daily or weekly habits.',
  },
  {
    value: 'health_energy',
    code: '[HE]',
    label: 'Health / Energy Maintenance',
    description: 'Water, movement, rest, and energy-aware planning.',
  },
  {
    value: 'life_admin',
    code: '[LA]',
    label: 'Life Organization',
    description: 'Admin tasks, reminders, planning, and cleanup.',
  },
  {
    value: 'creative_projects',
    code: '[CP]',
    label: 'Creative / Personal Projects',
    description: 'Writing, art, coding projects, and personal systems.',
  },
];

const PRIORITY_OPTIONS: Array<{ value: PriorityMode; code: string; label: string }> = [
  { value: 'deadline', code: '[D]', label: 'Closest deadline' },
  { value: 'critical', code: '[C]', label: 'Critical priority' },
  { value: 'easy_start', code: '[E]', label: 'Easiest useful action' },
  { value: 'daily_focus', code: '[F]', label: 'Daily focus' },
  { value: 'energy_match', code: '[M]', label: 'Energy-matched action' },
];

const LOW_ENERGY_OPTIONS: Array<{ value: LowEnergyPreference; code: string; label: string }> = [
  { value: 'short_tasks', code: '[S]', label: 'Short useful tasks' },
  { value: 'admin', code: '[A]', label: 'Low-energy admin tasks' },
  { value: 'recovery', code: '[R]', label: 'Recovery actions' },
  { value: 'health', code: '[H]', label: 'Health checks' },
  { value: 'critical_only', code: '[C]', label: 'Critical items only' },
];

export default function RecommendationProfilePanel({ onSaved, onCancel }: Props) {
  const profile = useLiveQuery(() => db.needsProfiles.get(NEEDS_PROFILE_ID), []);
  const [selectedNeeds, setSelectedNeeds] = useState<NeedType[]>([]);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>('easy_start');
  const [lowEnergyPreference, setLowEnergyPreference] = useState<LowEnergyPreference>('short_tasks');
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [checkInIntervalHours, setCheckInIntervalHours] = useState(6);
  const [quietHoursStart, setQuietHoursStart] = useState('23:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSelectedNeeds(profile.selectedNeeds);
    setPriorityMode(profile.priorityMode);
    setLowEnergyPreference(profile.lowEnergyPreference);
    setCheckInEnabled(profile.checkInEnabled);
    setCheckInIntervalHours(profile.checkInIntervalHours);
    setQuietHoursStart(profile.quietHoursStart);
    setQuietHoursEnd(profile.quietHoursEnd);
  }, [profile?.updatedAt]);

  const toggleNeed = (need: NeedType) => {
    setSelectedNeeds(current => current.includes(need)
      ? current.filter(value => value !== need)
      : [...current, need]);
  };

  const handleSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateNeedsProfile({
        selectedNeeds,
        priorityMode,
        lowEnergyPreference,
        checkInEnabled,
        checkInIntervalHours,
        quietHoursStart,
        quietHoursEnd,
        onboardingCompletedAt: profile.onboardingCompletedAt ?? now,
        onboardingDismissedAt: undefined,
        nextStateCheckAt: checkInEnabled ? profile.nextStateCheckAt : undefined,
        stateCheckDismissCount: checkInEnabled ? (profile.stateCheckDismissCount ?? 0) : 0,
      });

      if (checkInEnabled) {
        await scheduleNextStateCheck(new Date());
      }

      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Profile saved.' }));
      onSaved?.();
    } catch (error) {
      console.error('[needs-profile] save failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Profile save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="mono" style={{ color: 'var(--dim)', fontSize: '12px' }}>Loading profile...</div>;
  }

  return (
    <div className="needs-profile-panel">
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div className="mono" style={{ color: 'var(--primary)', fontSize: '14px' }}>
          RECOMMENDATION PROFILE
        </div>
        <p style={{ color: 'var(--secondary)', fontSize: '12px', lineHeight: 1.65, marginTop: '8px' }}>
          Configure how NOW_WHAT? prioritizes tasks, habits, calendar context, recovery actions,
          and energy-matched recommendations. Your answers stay local to this profile.
        </p>
      </header>

      <fieldset className="needs-fieldset">
        <legend className="mono label-hi">WHAT ARE YOU USING NOW_WHAT? FOR?</legend>
        <p className="needs-question-copy">Choose all that apply. These answers only affect local recommendations.</p>
        <div className="needs-choice-grid">
          {NEED_OPTIONS.map(option => {
            const selected = selectedNeeds.includes(option.value);
            return (
              <label key={option.value} className={`needs-choice${selected ? ' is-selected' : ''}`}>
                <input
                  className="profile-choice-input"
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleNeed(option.value)}
                />
                <span className="needs-choice-code mono">{option.code}</span>
                <span className="needs-choice-copy">
                  <span className="needs-choice-title">{option.label}</span>
                  <span className="needs-choice-description">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="needs-fieldset">
        <legend className="mono label-hi">WHAT SHOULD USUALLY COME FIRST?</legend>
        <div className="needs-choice-grid compact" role="radiogroup" aria-label="Recommendation priority mode">
          {PRIORITY_OPTIONS.map(option => (
            <label key={option.value} className={`needs-choice${priorityMode === option.value ? ' is-selected' : ''}`}>
              <input
                className="profile-choice-input"
                type="radio"
                name="priority-mode"
                value={option.value}
                checked={priorityMode === option.value}
                onChange={() => setPriorityMode(option.value)}
              />
              <span className="needs-choice-code mono">{option.code}</span>
              <span className="needs-choice-title">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="needs-fieldset">
        <legend className="mono label-hi">WHEN ENERGY IS LOW, WHAT SHOULD NOW_WHAT? PREFER?</legend>
        <div className="needs-choice-grid compact" role="radiogroup" aria-label="Low energy recommendation preference">
          {LOW_ENERGY_OPTIONS.map(option => (
            <label key={option.value} className={`needs-choice${lowEnergyPreference === option.value ? ' is-selected' : ''}`}>
              <input
                className="profile-choice-input"
                type="radio"
                name="low-energy-preference"
                value={option.value}
                checked={lowEnergyPreference === option.value}
                onChange={() => setLowEnergyPreference(option.value)}
              />
              <span className="needs-choice-code mono">{option.code}</span>
              <span className="needs-choice-title">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="needs-fieldset">
        <legend className="mono label-hi">STATE CHECK</legend>
        <p className="needs-question-copy">
          State checks help NOW_WHAT? understand current capacity. They stay local and can be disabled at any time.
        </p>
        <label className="needs-toggle-row">
          <input
            type="checkbox"
            checked={checkInEnabled}
            onChange={event => setCheckInEnabled(event.target.checked)}
          />
          <span className="mono">Ask for state check</span>
        </label>
        <div className="needs-settings-grid">
          <label>
            <span className="label">INTERVAL (HOURS)</span>
            <input
              type="number"
              min="1"
              max="168"
              step="1"
              value={checkInIntervalHours}
              disabled={!checkInEnabled}
              onChange={event => setCheckInIntervalHours(Math.min(168, Math.max(1, Number(event.target.value) || 1)))}
            />
          </label>
          <label>
            <span className="label">QUIET HOURS START</span>
            <input
              type="time"
              value={quietHoursStart}
              disabled={!checkInEnabled}
              onChange={event => setQuietHoursStart(event.target.value)}
            />
          </label>
          <label>
            <span className="label">QUIET HOURS END</span>
            <input
              type="time"
              value={quietHoursEnd}
              disabled={!checkInEnabled}
              onChange={event => setQuietHoursEnd(event.target.value)}
            />
          </label>
        </div>
        <p className="needs-question-copy" style={{ marginTop: '10px', marginBottom: 0 }}>
          State Check Energy Level records your current energy from 1 to 5. Task ENERGY remains the effort a task requires.
        </p>
      </fieldset>

      <div className="needs-actions">
        {onCancel && (
          <button type="button" className="mono needs-secondary-button" onClick={onCancel} disabled={saving}>
            CANCEL
          </button>
        )}
        <button type="button" className="mono needs-primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'SAVING...' : 'SAVE PROFILE'}
        </button>
      </div>
    </div>
  );
}
