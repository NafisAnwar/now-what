import React, { useRef, useState } from 'react';
import { validateBackup, restoreDatabase } from '../../data/exportImport';
import type { NowWhatBackup, ImportSummary } from '../../data/exportImport';

type Stage = 'idle' | 'parsed' | 'confirming' | 'restoring' | 'done' | 'error';

export default function ImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [backup, setBackup] = useState<NowWhatBackup | null>(null);

  const reset = () => {
    setStage('idle');
    setErrorMsg('');
    setSummary(null);
    setBackup(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStage('idle');
    setErrorMsg('');
    setSummary(null);
    setBackup(null);

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setErrorMsg('Could not read backup file.');
      setStage('error');
      return;
    }

    const result = validateBackup(parsed);
    if (!result.valid || !result.backup || !result.summary) {
      setErrorMsg(result.reason || 'Backup structure not recognized.');
      setStage('error');
      return;
    }

    setSummary(result.summary);
    setBackup(result.backup);
    setStage('parsed');
  };

  const handleRestore = async () => {
    if (!backup) return;
    setStage('restoring');
    try {
      await restoreDatabase(backup);
      setStage('done');
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Backup restored.' }));
      // Reload after a short delay to reflect fresh data
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setErrorMsg('Restore failed. No data was changed.');
      setStage('error');
    }
  };

  const summaryRows: [string, number][] = summary ? [
    ['Tasks', summary.tasks],
    ['Habits', summary.habits],
    ['Goals', summary.goals],
    ['Calendar Blocks', summary.calendarBlocks],
    ['Activity Logs', summary.activityLogs],
    ['Daily Plans', summary.dailyPlans],
    ['Suggestions', summary.suggestions],
    ['Daily Reviews', summary.dailyReviews],
    ['Weekly Reviews', summary.weeklyReviews],
    ['Settings', summary.settings],
    ['Reminders', summary.reminders],
  ] : [];

  const row: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between',
    padding: '3px 0', borderBottom: '1px solid var(--border)',
  };

  return (
    <div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '16px', lineHeight: 1.6 }}>
        Import replaces current local data with a previously exported NOW_WHAT? backup.
        A summary is shown before restore.
      </div>

      <div className="mono" style={{
        border: '1px solid var(--border)', padding: '10px 14px', marginBottom: '16px',
        fontSize: '11px', color: 'var(--dim)', lineHeight: 1.6,
      }}>
        Import will replace current local data.
      </div>

      {(stage === 'idle' || stage === 'error') && (
        <div>
          <label
            className="mono"
            style={{
              display: 'inline-block', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--dim)', fontSize: '12px', padding: '6px 14px',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            [SELECT BACKUP FILE]
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </label>

          {stage === 'error' && (
            <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '12px' }}>
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {stage === 'parsed' && summary && (
        <div>
          <div className="mono" style={{
            fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '8px',
          }}>
            IMPORT SUMMARY
          </div>
          <div style={{ marginBottom: '16px' }}>
            {summaryRows.map(([label, count]) => (
              <div key={label} style={row}>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>{label}</span>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              onClick={handleRestore}
              className="mono"
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border-hi)',
                color: 'var(--white)', fontSize: '12px', padding: '8px 16px',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              [RESTORE BACKUP]
            </button>
            <button
              onClick={reset}
              className="mono"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', fontSize: '12px', padding: '8px 14px',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              [CANCEL]
            </button>
          </div>
        </div>
      )}

      {stage === 'restoring' && (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
          RESTORING...
        </div>
      )}

      {stage === 'done' && (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>
          Backup restored. Reloading...
        </div>
      )}
    </div>
  );
}
