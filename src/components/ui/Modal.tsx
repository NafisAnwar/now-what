import React, { useEffect } from 'react';

export default function Modal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div 
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-hi)',
          width: '100%',
          maxWidth: '480px',
          padding: '24px',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
