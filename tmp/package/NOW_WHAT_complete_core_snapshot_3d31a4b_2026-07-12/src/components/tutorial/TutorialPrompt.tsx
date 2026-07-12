import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { getTutorialStatus, markTutorialDismissed, markTutorialPromptSeen } from '../../data/tutorial';

export default function TutorialPrompt() {
  const [location, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTutorialStatus()
      .then(status => {
        if (cancelled) return;
        setVisible(status.shouldShowPrompt);
        setLoaded(true);
      })
      .catch(err => {
        console.error('[tutorial] prompt check failed:', err);
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    await markTutorialDismissed();
    setVisible(false);
  };

  const openGuide = async () => {
    await markTutorialPromptSeen();
    setVisible(false);
    navigate('/guide');
  };

  useEffect(() => {
    if (!visible || location === '/guide') return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss().catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, location]);

  if (!loaded || !visible || location === '/guide') return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 8000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-prompt-title"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--surface)',
          border: '1px solid var(--border-hi)',
          padding: '24px',
          boxShadow: '0 0 0 1px var(--border)',
        }}
      >
        <div
          id="tutorial-prompt-title"
          className="mono"
          style={{
            color: 'var(--primary)',
            fontSize: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
          }}
        >
          QUICK START GUIDE
        </div>
        <p
          style={{
            color: 'var(--body)',
            fontSize: '13px',
            lineHeight: 1.7,
            marginBottom: '20px',
          }}
        >
          Open the quick start guide to learn how NOW_WHAT? tracks your day,
          recommends the next action, and keeps your data local.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss quick start guide prompt"
            className="mono"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--dim)',
              fontSize: '12px',
              padding: '8px 14px',
              textTransform: 'uppercase',
            }}
          >
            [NOT NOW]
          </button>
          <button
            type="button"
            onClick={openGuide}
            aria-label="View quick start guide"
            className="mono"
            autoFocus
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border-hi)',
              color: 'var(--white)',
              fontSize: '12px',
              padding: '8px 14px',
              textTransform: 'uppercase',
            }}
          >
            [VIEW GUIDE]
          </button>
        </div>
      </section>
    </div>
  );
}
