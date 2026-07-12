import React, { useState } from 'react';
import SchemaPanel from './SchemaPanel';
import ExportPanel from './ExportPanel';
import ImportPanel from './ImportPanel';
import IntegrityPanel from './IntegrityPanel';
import DangerZone from './DangerZone';
import RecommendationProfilePanel from '../needs/RecommendationProfilePanel';

type Tab = 'schema' | 'profile' | 'export' | 'import' | 'integrity' | 'danger';

export default function DataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('schema');

  const tabBtn = (tab: Tab, label: string): React.ReactElement => {
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className="mono"
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
          color: active ? 'var(--primary)' : 'var(--dim)',
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          padding: '8px 12px',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px',
        marginBottom: '0',
      }}>
        <div className="mono label" style={{ fontSize: '14px' }}>DATA</div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '4px' }}>
          Local-first. No account required. All data stored in this browser.
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
        overflowX: 'auto',
      }}>
        {tabBtn('schema', 'STATUS')}
        {tabBtn('profile', 'PROFILE')}
        {tabBtn('export', 'EXPORT')}
        {tabBtn('import', 'IMPORT')}
        {tabBtn('integrity', 'INTEGRITY')}
        {tabBtn('danger', 'DANGER ZONE')}
      </div>

      {activeTab === 'schema' && <SchemaPanel />}
      {activeTab === 'profile' && <RecommendationProfilePanel />}
      {activeTab === 'export' && <ExportPanel />}
      {activeTab === 'import' && <ImportPanel />}
      {activeTab === 'integrity' && <IntegrityPanel />}
      {activeTab === 'danger' && <DangerZone />}
    </div>
  );
}
