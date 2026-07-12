import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContext = createContext<((msg: string) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('show_toast', handler);
    return () => window.removeEventListener('show_toast', handler);
  }, []);

  return (
    <ToastContext.Provider value={(msg) => setToast(msg)}>
      {children}
      {toast && (
        <div 
          className="mono border-hi"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--surface)',
            color: 'var(--white)',
            padding: '12px 24px',
            fontSize: '12px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}
        >
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const fn = useContext(ToastContext);
  if (!fn) throw new Error('useToast used outside ToastProvider');
  return fn;
}
