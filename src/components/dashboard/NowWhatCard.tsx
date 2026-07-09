import React, { useCallback, useEffect, useRef, useState } from 'react';
import { generateWithDebugInfo, acceptSuggestion, dismissSuggestion, completeSuggestion } from '../../engine/nowWhat';
import { db } from '../../data/db';
import type { Context } from '../../engine/nowWhat';
import type { Suggestion } from '../../types';
import { localDateStr } from '../../utils/dateUtils';

const COMPUTING_MESSAGES = ['COMPUTING', 'SCANNING CONTEXT', 'RESOLVING NEXT ACTION'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isEmptyContext(context: Context | null): boolean {
  if (!context) return false;

  const hasTrackedActivity =
    context.meaningfulActivityCountToday > 0 ||
    context.completedTasksToday > 0 ||
    context.waterMlToday > 0 ||
    context.focusMinutesToday > 0 ||
    context.restMinutesToday > 0 ||
    context.movementMinutesToday > 0 ||
    context.distractionMinutesToday > 0 ||
    context.lastEnergyValue !== null ||
    context.lastMoodValue !== null;

  return (
    context.pendingTasks.length === 0 &&
    context.pendingHabitsAny.length === 0 &&
    context.activeGoals.length === 0 &&
    context.todaysCalendarBlocks.length === 0 &&
    context.plannedTaskIds.length === 0 &&
    context.plannedHabitIds.length === 0 &&
    !context.primaryFocus &&
    !context.yesterdayReviewIncomplete &&
    !hasTrackedActivity
  );
}

export default function NowWhatCard() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [computingStep, setComputingStep] = useState(0);
  const generatingRef = useRef(false);

  const generate = useCallback(async (showLoading = true) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    const startedAt = Date.now();
    if (showLoading) setLoading(true);

    try {
      const { suggestion: newSug, context, candidates } = await generateWithDebugInfo();
      setSuggestion(newSug);
      setContext(context);
      window.dispatchEvent(new CustomEvent('engine_debug_update', {
        detail: { context, candidates, suggestion: newSug }
      }));
    } catch (err) {
      console.error('[nowwhat] generation failed:', err);
    } finally {
      if (showLoading) {
        const minDuration = prefersReducedMotion() ? 80 : 560;
        const remaining = minDuration - (Date.now() - startedAt);
        if (remaining > 0) await wait(remaining);
        setLoading(false);
      }
      generatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      setComputingStep(0);
      return;
    }
    if (prefersReducedMotion()) return;

    const interval = setInterval(() => {
      setComputingStep(step => (step + 1) % COMPUTING_MESSAGES.length);
    }, 180);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    generate();

    const handleRegen = () => generate();
    const handleFocus = () => generate(false);
    const handleVisibility = () => {
      if (!document.hidden) generate(false);
    };
    const interval = setInterval(() => generate(false), 5 * 60 * 1000);

    window.addEventListener('regenerate_now_what', handleRegen);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('regenerate_now_what', handleRegen);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [generate]);

  if (loading) {
    return (
      <div className="border-hi" style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-hi)',
        minHeight: '180px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px'
      }}>
        <div className="mono nowwhat-compute" style={{ color: 'var(--secondary)', textTransform: 'uppercase' }}>
          {COMPUTING_MESSAGES[computingStep]}
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  const emptyState = isEmptyContext(context);
  const display = emptyState
    ? {
        command: 'NO CONTEXT AVAILABLE',
        targetLabel: 'Add a task, habit, or calendar block to activate recommendations.',
        reason: 'NOW_WHAT? needs at least one user-created item before it can suggest the next action.',
      }
    : suggestion;

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border-hi)',
      minHeight: '180px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      marginBottom: '32px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="label">NOW_WHAT?</div>
        <button
          onClick={() => generate()}
          className="mono"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dim)',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          [REGENERATE]
        </button>
      </div>

      <div style={{ margin: '16px 0' }}>
        <div className="mono" style={{ fontSize: '24px', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
          {display.command}
        </div>
        <div className="mono" style={{ fontSize: '16px', color: 'var(--white)', marginBottom: '8px' }}>
          {display.targetLabel}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--secondary)' }}>
          {display.reason}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
      {emptyState ? (
        <button
          onClick={() => window.dispatchEvent(new Event('open_task_modal'))}
          className="mono border-hi"
          style={{
            background: 'var(--surface2)',
            color: 'var(--white)',
            padding: '8px 16px',
            fontSize: '12px',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          [ADD TASK]
        </button>
      ) : (
        <>
        <button
          onClick={async () => {
            await acceptSuggestion(suggestion.id);

            const { actionType, targetId } = suggestion;
            let needsRegen = true;

            if (actionType === 'start_task') {
              window.dispatchEvent(new CustomEvent('focus_task', { detail: { taskId: targetId } }));
              window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Task started. Find it in your task list.' }));
            } else if (actionType === 'log_water' || actionType === 'rest' || actionType === 'move') {
              window.dispatchEvent(new Event('open_quick_log'));
              needsRegen = false; // QuickLog close will trigger regen via regenerate_now_what
            } else if (actionType === 'complete_habit' && targetId) {
              // Complete the habit inline, matching the same pipeline as HabitRow
              const habit = await db.habits.get(targetId);
              if (habit) {
                const now = new Date();
                const todayStr = localDateStr(now);
                if (!habit.completionHistory.some((c: { date: string }) => c.date === todayStr)) {
                  await db.habits.update(targetId, {
                    completionHistory: [...habit.completionHistory, { date: todayStr, value: 1, completedAt: now.toISOString() }]
                  });
                  await db.activityLogs.add({
                    id: crypto.randomUUID(),
                    type: 'habit_completed',
                    label: `Habit: ${habit.name}`,
                    relatedHabitId: habit.id,
                    createdAt: now.toISOString(),
                  });
                }
                await completeSuggestion(suggestion.id);
                window.dispatchEvent(new CustomEvent('show_toast', { detail: `Habit "${habit.name}" marked complete.` }));
              }
            } else if (actionType === 'review_day') {
              // Navigate to review page; if this was the "yesterday incomplete" rule, open yesterday's panel
              if (suggestion.command === 'COMPLETE REVIEW') {
                window.dispatchEvent(new Event('navigate_review'));
                // Small delay so the page mounts before we switch the date
                setTimeout(() => window.dispatchEvent(new Event('navigate_review_yesterday')), 80);
              } else {
                window.dispatchEvent(new Event('navigate_review'));
              }
              needsRegen = false;
            } else if (actionType === 'acknowledge_block') {
              window.dispatchEvent(new CustomEvent('show_toast', { detail: 'Block acknowledged.' }));
            }
            // clear_state: no-op

            if (needsRegen) {
              setTimeout(() => generate(), 100);
            }
          }}
          className="mono border-hi"
          style={{
            background: 'var(--surface2)',
            color: 'var(--white)',
            padding: '8px 16px',
            fontSize: '12px',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          [ACCEPT]
        </button>
        <button
          onClick={async () => {
            await dismissSuggestion(suggestion.id);
            setLoading(true);
            // Pass the dismissed target as an exclusion so the engine picks something different
            const { suggestion: newSug, context, candidates } = await generateWithDebugInfo([
              { actionType: suggestion.actionType, targetId: suggestion.targetId }
            ]);
            setSuggestion(newSug);
            setContext(context);
            window.dispatchEvent(new CustomEvent('engine_debug_update', {
              detail: { context, candidates, suggestion: newSug }
            }));
            setLoading(false);
          }}
          className="mono border-line"
          style={{
            background: 'transparent',
            color: 'var(--dim)',
            padding: '8px 16px',
            fontSize: '12px',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          [DISMISS]
        </button>
        </>
      )}
      </div>
    </div>
  );
}
