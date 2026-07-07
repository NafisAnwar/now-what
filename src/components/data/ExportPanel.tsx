import React, { useState } from 'react';
import { exportDatabase } from '../../data/exportImport';

export default function ExportPanel() {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setDone(false);
    try {
      await exportDatabase();
      setDone(true);
      window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Backup exported.' }));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '16px', lineHeight: 1.6 }}>
        Exports active local profile data as a JSON backup file. Includes profile metadata,
        tasks, habits, goals, calendar blocks, activity logs, daily plans, suggestions,
        reviews, settings, and reminders.
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '12px 16px',
          marginBottom: '20px',
        }}
      >
        <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Export format
        </div>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--body)', lineHeight: 1.6 }}>
          Format: JSON<br />
          Filename: <span style={{ color: 'var(--dim)' }}>now_what_backup_YYYY-MM-DD_HH-mm.json</span><br />
          Includes: app name, export version, schema version, profile metadata, exportedAt timestamp
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="mono"
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border-hi)',
          color: 'var(--white)',
          fontSize: '12px',
          padding: '8px 20px',
          cursor: exporting ? 'default' : 'pointer',
          textTransform: 'uppercase',
          opacity: exporting ? 0.6 : 1,
        }}
      >
        {exporting ? 'EXPORTING...' : '[EXPORT BACKUP]'}
      </button>

      {done && (
        <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '10px' }}>
          Backup exported.
        </div>
      )}
    </div>
  );
}
