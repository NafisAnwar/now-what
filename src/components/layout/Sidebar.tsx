import React from 'react';
import { Link, useLocation } from 'wouter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const [location] = useLocation();

  const navItems = [
    { label: 'DASHBOARD', path: '/' },
    { label: 'TASKS', path: '/tasks' },
    { label: 'HABITS', path: '/habits' },
    { label: 'GOALS', path: '/goals' },
    { label: 'CALENDAR', path: '/calendar' },
    { label: 'REVIEW', path: '/review' },
    { label: 'REMINDERS', path: '/reminders' },
    { label: 'TIMELINE', path: '/timeline' },
    { label: 'DATA', path: '/data' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 49,
          }}
          className="sidebar-backdrop"
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '176px',
          borderRight: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <nav style={{ padding: '8px 0', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className="mono sidebar-link"
                aria-current={isActive ? 'page' : undefined}
                style={{
                  borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  color: isActive ? 'var(--primary)' : 'var(--dim)',
                }}
              >
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '12px 16px', color: 'var(--dim)', fontSize: '10px' }} className="mono">
          v0.9.0
        </div>
      </aside>
    </>
  );
}
