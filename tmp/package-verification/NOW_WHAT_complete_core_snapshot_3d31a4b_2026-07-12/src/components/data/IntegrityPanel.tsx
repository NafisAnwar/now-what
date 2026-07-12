import React, { useState } from 'react';
import { runIntegrityChecks } from '../../data/integrity';
import type { IntegrityReport, IntegrityIssue } from '../../data/integrity';

export default function IntegrityPanel() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [running, setRunning] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Set<string>>(new Set());

  const run = async () => {
    setRunning(true);
    setFixed(new Set());
    try {
      const result = await runIntegrityChecks();
      setReport(result);
    } finally {
      setRunning(false);
    }
  };

  const handleFix = async (issue: IntegrityIssue, key: string) => {
    if (!issue.fix) return;
    setFixingId(key);
    try {
      await issue.fix();
      setFixed(prev => new Set([...prev, key]));
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Fixed.' }));
    } finally {
      setFixingId(null);
    }
  };

  const issueKey = (issue: IntegrityIssue, idx: number) =>
    `${issue.store}-${issue.id}-${idx}`;

  return (
    <div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '16px', lineHeight: 1.6 }}>
        Checks for broken references, duplicate IDs, and missing links across all stores.
        Does not modify data unless you apply a fix explicitly.
      </div>

      <button
        onClick={run}
        disabled={running}
        className="mono"
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border-hi)',
          color: 'var(--white)', fontSize: '12px', padding: '7px 16px',
          cursor: running ? 'default' : 'pointer', textTransform: 'uppercase',
          opacity: running ? 0.6 : 1, marginBottom: '20px',
        }}
      >
        {running ? 'CHECKING...' : '[RUN INTEGRITY CHECKS]'}
      </button>

      {report && (
        <div>
          <div className="mono" style={{
            fontSize: '10px', color: 'var(--dim)', marginBottom: '12px',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Checked at {new Date(report.checkedAt).toLocaleTimeString()}
          </div>

          {report.issues.length === 0 ? (
            <div className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>
              No integrity issues detected.
            </div>
          ) : (
            <div>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '8px' }}>
                {report.issues.length} issue(s) found.
              </div>
              {report.issues.map((issue, idx) => {
                const key = issueKey(issue, idx);
                const isFixed = fixed.has(key);
                const isFixin = fixingId === key;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      opacity: isFixed ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: '9px',
                          border: '1px solid var(--border)',
                          padding: '1px 4px',
                          color: issue.type === 'error' ? 'var(--body)' : 'var(--dim)',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        {issue.type === 'error' ? 'ERR' : 'WARN'}
                      </span>
                      <div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--body)', lineHeight: 1.5 }}>
                          {issue.message}
                        </div>
                        <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '2px' }}>
                          {issue.store} / {issue.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>

                    {issue.fixable && issue.fix && !isFixed && (
                      <button
                        onClick={() => handleFix(issue, key)}
                        disabled={!!fixingId}
                        className="mono"
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--dim)', fontSize: '10px', padding: '2px 8px',
                          cursor: fixingId ? 'default' : 'pointer', textTransform: 'uppercase',
                          marginTop: '4px', marginLeft: '28px',
                        }}
                      >
                        {isFixin ? 'FIXING...' : `[${issue.fixLabel || 'FIX'}]`}
                      </button>
                    )}
                    {isFixed && (
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginLeft: '28px', marginTop: '4px' }}>
                        — fixed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
