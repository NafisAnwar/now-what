import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { db } from '../../data/db';
import { dismissNeedsOnboarding, NEEDS_PROFILE_ID } from '../../data/needsProfile';
import Modal from '../ui/Modal';
import RecommendationProfilePanel from './RecommendationProfilePanel';

export default function NeedsOnboardingPrompt() {
  const [location] = useLocation();
  const [configuring, setConfiguring] = useState(false);
  const status = useLiveQuery(async () => {
    const [settings, profile] = await Promise.all([
      db.settings.toArray(),
      db.needsProfiles.get(NEEDS_PROFILE_ID),
    ]);
    const currentSettings = settings[0];
    const tutorialHandled = Boolean(
      currentSettings?.tutorialPromptSeenAt ||
      currentSettings?.tutorialCompletedAt ||
      currentSettings?.tutorialDismissedAt
    );
    return { tutorialHandled, profile };
  }, []);

  const shouldShowPrompt = Boolean(
    status &&
    status.tutorialHandled &&
    status.profile &&
    !status.profile.onboardingCompletedAt &&
    !status.profile.onboardingDismissedAt &&
    location !== '/guide'
  );

  const dismiss = async () => {
    await dismissNeedsOnboarding();
  };

  useEffect(() => {
    if (!shouldShowPrompt || configuring) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismiss().catch(console.error);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldShowPrompt, configuring]);

  if (configuring) {
    return (
      <Modal onClose={() => setConfiguring(false)} ariaLabel="Recommendation Profile">
        <section>
          <RecommendationProfilePanel
            onSaved={() => setConfiguring(false)}
            onCancel={() => setConfiguring(false)}
          />
        </section>
      </Modal>
    );
  }

  if (!shouldShowPrompt) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 7900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="needs-onboarding-title"
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'var(--surface)',
          border: '1px solid var(--border-hi)',
          padding: '24px',
          boxShadow: '0 0 0 1px var(--border)',
        }}
      >
        <div
          id="needs-onboarding-title"
          className="mono"
          style={{ color: 'var(--primary)', fontSize: '16px', marginBottom: '12px' }}
        >
          RECOMMENDATION PROFILE
        </div>
        <p style={{ color: 'var(--body)', fontSize: '13px', lineHeight: 1.7, marginBottom: '20px' }}>
          Configure how NOW_WHAT? prioritizes tasks, habits, calendar context, recovery actions,
          and energy-matched recommendations. Your answers stay local to this profile.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => dismiss().catch(console.error)}
            className="mono needs-secondary-button"
          >
            NOT NOW
          </button>
          <button
            type="button"
            onClick={() => setConfiguring(true)}
            className="mono needs-primary-button"
            autoFocus
          >
            CONFIGURE
          </button>
        </div>
      </section>
    </div>
  );
}
