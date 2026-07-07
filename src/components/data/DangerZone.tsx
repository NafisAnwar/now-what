import React, { useState } from 'react';
import { clearAllStores, clearSuggestionsOnly } from '../../data/exportImport';
import { reseedWithDemoData } from '../../data/seed';

const CONFIRM_PHRASE = 'CLEAR NOW_WHAT';

export default function DangerZone() {
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearingSugg, setClearingSugg] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  const handleClearAll = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setClearing(true);
    try {
      await clearAllStores();
      // Set the manual-clear guard so the app does not auto-seed on next load
      localStorage.setItem('nowwhat_manual_clear', '1');
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Local data cleared.' }));
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setClearing(false);
    }
  };

  const handleClearSuggestions = async () => {
    setClearingSugg(true);
    try {
      await clearSuggestionsOnly();
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Suggestions cleared.' }));
      window.dispatchEvent(new Event('regenerate_now_what'));
    } finally {
      setClearingSugg(false);
    }
  };

  const handleReseed = async () => {
    setReseeding(true);
    try {
      await clearAllStores();
      await reseedWithDemoData();
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Demo data restored.' }));
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setReseeding(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    padding: '16px',
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  };

  const warnStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--dim)',
    fontFamily: 'var(--mono)',
    lineHeight: 1.6,
    marginBottom: '12px',
  };

  return (
    <div>
      {/* Clear suggestions only */}
      <div style={sectionStyle}>
        <div style={labelStyle}>CLEAR SUGGESTIONS ONLY</div>
        <div style={warnStyle}>
          Removes all suggestion records. Does not affect tasks, habits, goals, or other data.
          NOW_WHAT? will regenerate suggestions on next load.
        </div>
        <button
          onClick={handleClearSuggestions}
          disabled={clearingSugg}
          className="mono"
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--dim)', fontSize: '11px', padding: '5px 12px',
            cursor: clearingSugg ? 'default' : 'pointer', textTransform: 'uppercase',
            opacity: clearingSugg ? 0.6 : 1,
          }}
        >
          {clearingSugg ? 'CLEARING...' : '[CLEAR SUGGESTIONS]'}
        </button>
      </div>

      {/* Reset demo data */}
      <div style={sectionStyle}>
        <div style={labelStyle}>RESET DEMO DATA</div>
        <div style={warnStyle}>
          Clears all local data and restores the original demo data set.
          Use for development and testing only.
        </div>
        <button
          onClick={handleReseed}
          disabled={reseeding}
          className="mono"
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--dim)', fontSize: '11px', padding: '5px 12px',
            cursor: reseeding ? 'default' : 'pointer', textTransform: 'uppercase',
            opacity: reseeding ? 0.6 : 1,
          }}
        >
          {reseeding ? 'RESETTING...' : '[RESET DEMO DATA]'}
        </button>
      </div>

      {/* Full clear */}
      <div style={{ ...sectionStyle, borderColor: 'var(--border-hi)' }}>
        <div style={{ ...labelStyle, color: 'var(--body)' }}>CLEAR ALL LOCAL DATA</div>
        <div style={warnStyle}>
          This removes all local NOW_WHAT? data from this browser.
          Export a backup first if needed.
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '6px' }}>
            Type <span style={{ color: 'var(--body)' }}>{CONFIRM_PHRASE}</span> to confirm:
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="mono"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--primary)', fontSize: '12px', padding: '6px 10px',
              fontFamily: 'var(--mono)', outline: 'none', borderRadius: 0,
              width: '240px',
            }}
          />
        </div>
        <button
          onClick={handleClearAll}
          disabled={confirmText !== CONFIRM_PHRASE || clearing}
          className="mono"
          style={{
            background: confirmText === CONFIRM_PHRASE ? 'var(--surface2)' : 'transparent',
            border: `1px solid ${confirmText === CONFIRM_PHRASE ? 'var(--border-hi)' : 'var(--border)'}`,
            color: confirmText === CONFIRM_PHRASE ? 'var(--white)' : 'var(--dim)',
            fontSize: '12px', padding: '7px 16px',
            cursor: confirmText === CONFIRM_PHRASE && !clearing ? 'pointer' : 'default',
            textTransform: 'uppercase',
            opacity: clearing ? 0.6 : 1,
          }}
        >
          {clearing ? 'CLEARING...' : '[CLEAR LOCAL DATA]'}
        </button>
      </div>
    </div>
  );
}
