import { useState, useEffect } from 'react';

/** Format a Date object as a local YYYY-MM-DD string (not UTC). */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local YYYY-MM-DD for stored timestamps, including ISO UTC strings. */
export function localDateFromTimestamp(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.split('T')[0] || value;
  return localDateStr(d);
}

/** True when a stored timestamp falls on the given local YYYY-MM-DD. */
export function isLocalDate(value: string, dateStr: string): boolean {
  return localDateFromTimestamp(value) === dateStr;
}

/** Today's date as a local YYYY-MM-DD string. */
export function getTodayStr(): string {
  return localDateStr(new Date());
}

/** Yesterday's date as a local YYYY-MM-DD string. */
export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

/**
 * The day after a YYYY-MM-DD string, using local date arithmetic.
 * Parses components directly so no UTC-shift risk.
 */
export function dayAfter(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, day + 1));
}

/**
 * Returns today's local date string that re-computes when:
 * - The browser tab gains focus
 * - The page becomes visible again (tab switch)
 * - Local midnight passes (timer recalculates)
 */
export function useTodayStr(): string {
  const [todayStr, setTodayStr] = useState(getTodayStr);

  useEffect(() => {
    const refresh = () => setTodayStr(getTodayStr());

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    // Schedule check at the next local midnight (+1 s buffer)
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      // new Date(y, m, d+1) is local midnight of the next day
      const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const msUntilMidnight = nextLocalMidnight.getTime() - now.getTime();
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight(); // re-arm
      }, msUntilMidnight + 1000);
    };
    scheduleMidnight();

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(timer);
    };
  }, []);

  return todayStr;
}
