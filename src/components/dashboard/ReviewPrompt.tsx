import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { db } from '../../data/db';
import { isDailyReviewIncomplete } from '../../data/review';
import type { DailyReview } from '../../types';
import { getTodayStr, getYesterdayStr } from '../../utils/dateUtils';

export default function ReviewPrompt() {
  const [, navigate] = useLocation();
  const [showTodayPrompt, setShowTodayPrompt] = useState(false);
  const [showYesterdayPrompt, setShowYesterdayPrompt] = useState(false);

  const check = useCallback(async () => {
    const now = new Date();
    const hour = now.getHours();
    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    // Today's review after 20:00
    if (hour >= 20) {
      const todayReview = await db.dailyReviews.where('date').equals(todayStr).first() as DailyReview | undefined;
      setShowTodayPrompt(!todayReview || todayReview.status !== 'complete');
    } else {
      setShowTodayPrompt(false);
    }

    // Yesterday incomplete (any time)
    setShowYesterdayPrompt(await isDailyReviewIncomplete(yesterdayStr));
  }, []);

  useEffect(() => {
    check();
    // Re-check every 5 minutes in case time passes 20:00 while app is open
    const interval = setInterval(check, 5 * 60 * 1000);
    // Re-check when engine regenerates (review completion may have changed state)
    window.addEventListener('regenerate_now_what', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('regenerate_now_what', check);
    };
  }, [check]);

  if (!showTodayPrompt && !showYesterdayPrompt) return null;

  const handleClick = () => {
    if (showYesterdayPrompt && !showTodayPrompt) {
      // Navigate to review and switch to yesterday
      navigate('/review');
      window.dispatchEvent(new Event('navigate_review_yesterday'));
    } else {
      navigate('/review');
    }
  };

  return (
    <div style={{
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '10px 16px',
      marginBottom: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        {showTodayPrompt && (
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
            Daily review available.
          </div>
        )}
        {showYesterdayPrompt && (
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
            Previous review incomplete.
          </div>
        )}
      </div>
      <button
        onClick={handleClick}
        className="mono"
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--dim)',
          fontSize: '11px',
          padding: '3px 8px',
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}
      >
        [REVIEW]
      </button>
    </div>
  );
}
