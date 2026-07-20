import React, { useEffect, useRef } from 'react';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export default function Modal({ children, onClose, ariaLabel, ariaLabelledBy }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable || dialogRef.current)?.focus();
    });

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      overflowY: 'auto',
      padding: '16px',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : (ariaLabel || 'Dialog')}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-hi)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: '24px',
          position: 'relative'
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
