import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';

interface Props {
  onMenuToggle: () => void;
  isOnline: boolean;
}

export default function Topbar({ onMenuToggle, isOnline }: Props) {
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
      height: '48px',
      padding: '0 16px',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      flexShrink: 0,
      gap: '16px',
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
        <Link
          href="/"
          className="mono topbar-logo"
          aria-label="Go to dashboard"
          style={{
            color: 'var(--white)',
            textTransform: 'uppercase',
            fontSize: '14.5px',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          NOW_WHAT?
        </Link>
      </div>

      {/* Right: status + install + clock */}
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

        {/* Clock */}
        <div className="mono" style={{ fontSize: '13px', letterSpacing: '0.05em', color: 'var(--body)', flexShrink: 0 }}>
          {time}
        </div>
      </div>
    </header>
  );
}
