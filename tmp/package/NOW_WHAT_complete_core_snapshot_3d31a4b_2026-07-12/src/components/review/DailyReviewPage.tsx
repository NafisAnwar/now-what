import React, { useState, useEffect } from 'react';
import { getWeekStart, generateWeeklySummary, getWeekEnd, isDailyReviewIncomplete } from '../../data/review';
import { useTodayStr, getYesterdayStr } from '../../utils/dateUtils';
import { db } from '../../data/db';
import DailyReviewPanel from './DailyReviewPanel';
import type { WeeklyReview } from '../../types';

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--dim)',
  fontFamily: 'var(--mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
  marginTop: '20px',
};

const metricRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '3px 0',
  borderBottom: '1px solid var(--border)',
};

function WeeklyPanel() {
  const [weekly, setWeekly] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const weekStart = getWeekStart();
    const summary = await generateWeeklySummary(weekStart);
    setWeekly(summary);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="mono" style={{ color: 'var(--dim)', fontSize: '12px', padding: '16px 0' }}>GENERATING WEEKLY SUMMARY...</div>;
  }
  if (!weekly) return null;

  const weekEnd = getWeekEnd(weekly.weekStart);
  const hasData = weekly.completedTaskCount > 0 || weekly.completedHabitCount > 0 || weekly.focusMinutes > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
          {weekly.weekStart} → {weekEnd}
        </span>
        <button onClick={load} className="mono" style={{ background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
          [REFRESH]
        </button>
      </div>

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: '8px' }}>
        <div className="mono" style={{ fontSize: '12px', color: 'var(--secondary)', lineHeight: 1.6 }}>
          {weekly.generatedSummary}
        </div>
      </div>

      {!hasData && <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '16px' }}>Not enough data yet.</div>}

      <div style={sectionLabel}>TASKS</div>
      <div style={metricRow}><span className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>Completed</span><span className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>{weekly.completedTaskCount}</span></div>
      <div style={metricRow}><span className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>Missed</span><span className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>{weekly.missedTaskCount}</span></div>

      <div style={sectionLabel}>HABITS</div>
      <div style={metricRow}><span className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>Total completions</span><span className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>{weekly.completedHabitCount}</span></div>

      {weekly.mostConsistentHabits.length > 0 && (
        <><div style={{ ...sectionLabel, marginTop: '12px' }}>MOST CONSISTENT</div>
          {weekly.mostConsistentHabits.map((n, i) => <div key={i} className="mono" style={{ fontSize: '12px', color: 'var(--body)', padding: '2px 0' }}>— {n}</div>)}
        </>
      )}
      {weekly.mostMissedHabits.length > 0 && (
        <><div style={{ ...sectionLabel, marginTop: '12px' }}>LEAST CONSISTENT</div>
          {weekly.mostMissedHabits.map((n, i) => <div key={i} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>— {n}</div>)}
        </>
      )}

      <div style={sectionLabel}>ACTIVITY</div>
      {([['Focus', `${weekly.focusMinutes} min`], ['Distraction', `${weekly.distractionMinutes} min`], ['Rest', `${weekly.restMinutes} min`], ['Movement', `${weekly.movementMinutes} min`], ['Water', `${weekly.waterMl} ml`], ['Meals', `${weekly.mealsLogged}`]] as [string, string][]).map(([l, v]) => (
        <div key={l} style={metricRow}><span className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>{l}</span><span className="mono" style={{ fontSize: '12px', color: 'var(--body)' }}>{v}</span></div>
      ))}

      <div style={sectionLabel}>PATTERNS</div>
      {!weekly.bestFocusWindow && !weekly.struggleWindow && weekly.repeatedMissedTaskTitles.length === 0 ? (
        <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)' }}>Not enough data yet.</div>
      ) : (
        <div>
          {weekly.bestFocusWindow && <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>Focus sessions were most concentrated between {weekly.bestFocusWindow}.</div>}
          {weekly.struggleWindow && <div className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>Distraction was highest between {weekly.struggleWindow}.</div>}
          {weekly.repeatedMissedTaskTitles.map((t, i) => <div key={i} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>Repeated miss: {t}</div>)}
        </div>
      )}

      {weekly.goalProgressNotes.length > 0 && (
        <><div style={sectionLabel}>GOAL PROGRESS</div>
          {weekly.goalProgressNotes.map((n, i) => <div key={i} className="mono" style={{ fontSize: '12px', color: 'var(--dim)', padding: '2px 0' }}>— {n}</div>)}
        </>
      )}
    </div>
  );
}

export default function DailyReviewPage() {
  const todayStr = useTodayStr();
  const yesterdayStr = getYesterdayStr();

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [reviewDate, setReviewDate] = useState<'today' | 'yesterday'>('today');
  const [yesterdayIncomplete, setYesterdayIncomplete] = useState(false);

  useEffect(() => {
    isDailyReviewIncomplete(yesterdayStr).then(setYesterdayIncomplete);
  }, [yesterdayStr]);

  useEffect(() => {
    const handler = () => {
      setActiveTab('daily');
      setReviewDate('yesterday');
    };
    window.addEventListener('navigate_review_yesterday', handler);
    return () => window.removeEventListener('navigate_review_yesterday', handler);
  }, []);

  const tabBtn = (tab: 'daily' | 'weekly'): React.CSSProperties => ({
    background: 'transparent', border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--dim)',
    fontFamily: 'var(--mono)', fontSize: '12px', padding: '8px 16px',
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
  });

  const dateBtn = (d: 'today' | 'yesterday'): React.CSSProperties => ({
    background: 'transparent', border: 'none',
    borderBottom: reviewDate === d ? '1px solid var(--primary)' : '1px solid transparent',
    color: reviewDate === d ? 'var(--primary)' : 'var(--dim)',
    fontFamily: 'var(--mono)', fontSize: '11px', padding: '4px 10px',
    cursor: 'pointer', textTransform: 'uppercase',
  });

  const activeDate = reviewDate === 'today' ? todayStr : yesterdayStr;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 0 64px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div className="mono label" style={{ fontSize: '14px' }}>REVIEW</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <button style={tabBtn('daily')} onClick={() => setActiveTab('daily')}>DAILY</button>
        <button style={tabBtn('weekly')} onClick={() => setActiveTab('weekly')}>WEEKLY</button>
      </div>

      {activeTab === 'daily' && (
        <div>
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <button style={dateBtn('today')} onClick={() => setReviewDate('today')}>TODAY</button>
            <button style={dateBtn('yesterday')} onClick={() => setReviewDate('yesterday')}>
              YESTERDAY
              {yesterdayIncomplete && (
                <span className="mono" style={{ fontSize: '9px', color: 'var(--dim)', marginLeft: '4px', border: '1px solid var(--border)', padding: '0 3px' }}>
                  INCOMPLETE
                </span>
              )}
            </button>
          </div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '16px' }}>{activeDate}</div>
          <DailyReviewPanel key={activeDate} date={activeDate} />
        </div>
      )}

      {activeTab === 'weekly' && <WeeklyPanel />}
    </div>
  );
}
