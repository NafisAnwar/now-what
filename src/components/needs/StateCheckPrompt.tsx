import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import {
  deferStateCheckForQuietHours,
  deferStateCheckUntil,
  dismissStateCheck,
  NEEDS_PROFILE_ID,
  isWithinNeedsQuietHours,
  saveStateCheck,
  scheduleNextStateCheck,
} from '../../data/needsProfile';
import type { StateType, UserEnergyLevel } from '../../types';
import Modal from '../ui/Modal';

const STATE_OPTIONS: StateType[] = [
  'clear',
  'neutral',
  'low',
  'stressed',
  'restless',
  'overloaded',
];

const ENERGY_LEVELS: UserEnergyLevel[] = [1, 2, 3, 4, 5];
const MINUTE_MS = 60 * 1000;

function useCurrentTime(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };
    const interval = window.setInterval(refresh, 30 * 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return now;
}

export default function StateCheckPrompt() {
  const now = useCurrentTime();
  const minuteKey = Math.floor(now.getTime() / MINUTE_MS);
  const profile = useLiveQuery(() => db.needsProfiles.get(NEEDS_PROFILE_ID), []);
  const calendarBlocks = useLiveQuery(() => db.calendarBlocks.toArray(), []) ?? [];
  const activeBlock = useMemo(() => {
    const nowMs = now.getTime();
    return calendarBlocks
      .filter(block => {
        const startMs = new Date(block.startAt).getTime();
        const endMs = new Date(block.endAt).getTime();
        return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= nowMs && endMs > nowMs;
      })
      .sort((a, b) => a.endAt.localeCompare(b.endAt))[0] ?? null;
  }, [calendarBlocks, minuteKey]);
  const [state, setState] = useState<StateType | null>(null);
  const [energyLevel, setEnergyLevel] = useState<UserEnergyLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deferring = useRef(false);

  const due = Boolean(
    profile?.checkInEnabled &&
    profile.onboardingCompletedAt &&
    profile.nextStateCheckAt &&
    new Date(profile.nextStateCheckAt).getTime() <= now.getTime()
  );
  const inQuietHours = Boolean(
    profile && isWithinNeedsQuietHours(now, profile.quietHoursStart, profile.quietHoursEnd)
  );

  useEffect(() => {
    if (!profile?.checkInEnabled || profile.nextStateCheckAt) return;
    scheduleNextStateCheck(now).catch(error => {
      console.error('[state-check] initial schedule failed:', error);
    });
  }, [profile?.checkInEnabled, profile?.nextStateCheckAt]);

  useEffect(() => {
    if (!due || deferring.current) return;

    const defer = async () => {
      deferring.current = true;
      try {
        if (inQuietHours) {
          await deferStateCheckForQuietHours(now);
          return;
        }
        if (activeBlock) {
          const blockEnd = new Date(activeBlock.endAt);
          const shortlyAfterBlock = Number.isNaN(blockEnd.getTime())
            ? new Date(now.getTime() + 30 * MINUTE_MS)
            : new Date(blockEnd.getTime() + 5 * MINUTE_MS);
          await deferStateCheckUntil(shortlyAfterBlock);
        }
      } catch (error) {
        console.error('[state-check] contextual defer failed:', error);
      } finally {
        deferring.current = false;
      }
    };

    if (inQuietHours || activeBlock) defer();
  }, [due, inQuietHours, activeBlock?.id, profile?.nextStateCheckAt, minuteKey]);

  const visible = due && !inQuietHours && !activeBlock;
  const canSave = state !== null && energyLevel !== null && !submitting;

  const energyLabels = useMemo<Record<UserEnergyLevel, React.ReactNode>>(() => ({
    1: <>1 &mdash; Low</>,
    2: <>2</>,
    3: <>3</>,
    4: <>4</>,
    5: <>5 &mdash; High</>,
  }), []);

  const handleSave = async () => {
    if (!state || !energyLevel || submitting) return;
    setSubmitting(true);
    try {
      await saveStateCheck(state, energyLevel);
      setState(null);
      setEnergyLevel(null);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'State saved.' }));
      window.dispatchEvent(new Event('regenerate_now_what'));
    } catch (error) {
      console.error('[state-check] save failed:', error);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'State save failed.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await dismissStateCheck();
      setState(null);
      setEnergyLevel(null);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'State check dismissed.' }));
    } catch (error) {
      console.error('[state-check] dismiss failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal onClose={() => { handleDismiss().catch(console.error); }} ariaLabelledBy="state-check-title">
      <section>
        <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '18px' }}>
          <div id="state-check-title" className="mono" style={{ color: 'var(--primary)', fontSize: '15px' }}>
            STATE CHECK
          </div>
          <p style={{ color: 'var(--body)', fontSize: '13px', lineHeight: 1.6, marginTop: '8px' }}>
            How are you operating right now?
          </p>
        </header>

        <fieldset className="needs-fieldset">
          <legend className="mono label-hi">CURRENT STATE</legend>
          <div className="state-option-grid">
            {STATE_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                className={`state-option-button${state === option ? ' is-selected' : ''}`}
                aria-pressed={state === option}
                onClick={() => setState(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="needs-fieldset">
          <legend className="mono label-hi">ENERGY LEVEL (REQUIRED)</legend>
          <p className="needs-question-copy">Current user energy, separate from a task's ENERGY requirement.</p>
          <div className="energy-level-grid">
            {ENERGY_LEVELS.map(level => (
              <button
                key={level}
                type="button"
                className={`energy-level-button${energyLevel === level ? ' is-selected' : ''}`}
                aria-pressed={energyLevel === level}
                onClick={() => setEnergyLevel(level)}
              >
                {energyLabels[level]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="needs-actions">
          <button
            type="button"
            className="mono needs-secondary-button"
            onClick={() => { handleDismiss().catch(console.error); }}
            disabled={submitting}
          >
            DISMISS
          </button>
          <button
            type="button"
            className="mono needs-primary-button"
            onClick={() => { handleSave().catch(console.error); }}
            disabled={!canSave}
          >
            {submitting ? 'SAVING...' : 'SAVE STATE'}
          </button>
        </div>
      </section>
    </Modal>
  );
}
