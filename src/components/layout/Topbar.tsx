import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  onMenuToggle: () => void;
  isOnline: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  onInstall: () => void;
}

export default function Topbar({ onMenuToggle, isOnline, installPrompt, onInstall }: Props) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '44px',
      padding: '0 12px',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      flexShrink: 0,
      gap: '8px',
    }}>
      {/* Left: hamburger (mobile) + app name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
          className="mono hamburger-btn"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--dim)',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
            display: 'none', // shown on mobile via CSS
          }}
        >
          ☰
        </button>
        <div className="mono" style={{ color: 'var(--white)', textTransform: 'uppercase', fontSize: '13px', whiteSpace: 'nowrap' }}>
          NOW_WHAT?
        </div>
      </div>

      {/* Center: clock */}
      <div className="mono" style={{ fontSize: '13px', letterSpacing: '0.05em', flexShrink: 0 }}>
        {time}
      </div>

      {/* Right: status + shortcuts + install */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Offline indicator */}
        {!isOnline && (
          <span
            className="mono"
            style={{ fontSize: '9px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--border)', padding: '1px 4px' }}
          >
            OFFLINE
          </span>
        )}

        {/* Install prompt */}
        {installPrompt && (
          <button
            onClick={onInstall}
            className="mono topbar-install"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--dim)',
              fontSize: '10px',
              padding: '2px 8px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            INSTALL APP
          </button>
        )}

        {/* Keyboard shortcuts hint — desktop only */}
        <div className="mono label shortcuts-hint" style={{ color: 'var(--dim)' }}>
          T &middot; H &middot; G &middot; L &middot; N
        </div>
      </div>
    </header>
  );
}
