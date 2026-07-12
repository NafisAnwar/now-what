import React from 'react';

interface TutorialSectionProps {
  index: string;
  title: string;
  children: React.ReactNode;
}

export default function TutorialSection({ index, title, children }: TutorialSectionProps) {
  return (
    <section
      style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 0',
      }}
    >
      <div
        className="mono label"
        style={{
          marginBottom: '8px',
          color: 'var(--dim)',
        }}
      >
        {index}
      </div>
      <h2
        className="mono"
        style={{
          color: 'var(--primary)',
          fontSize: '16px',
          lineHeight: 1.3,
          fontWeight: 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          color: 'var(--body)',
          fontSize: '13px',
          lineHeight: 1.7,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {children}
      </div>
    </section>
  );
}
