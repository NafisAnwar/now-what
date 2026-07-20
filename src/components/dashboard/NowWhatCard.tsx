import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptSuggestion,
  completeSuggestion,
  dismissSuggestion,
  generateRecommendationDeckWithDebugInfo,
  persistAlternativeSuggestion,
} from '../../engine/nowWhat';
import type { CandidateAction, Context } from '../../engine/nowWhat';
import { db } from '../../data/db';
import { completeHabit } from '../../data/completions';
import type { RecommendationDeck, Suggestion } from '../../types';

const COMPUTING_MESSAGES = ['COMPUTING', 'SCANNING CONTEXT', 'RESOLVING NEXT ACTION'];

type EngineResult = Awaited<ReturnType<typeof generateRecommendationDeckWithDebugInfo>>;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForResolvingFrame(startedAt: number): Promise<void> {
  const minDuration = prefersReducedMotion() ? 80 : 480;
  const remaining = minDuration - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
}

function snapshotString(snapshot: Record<string, unknown>, key: string): string | undefined {
  const value = snapshot[key];
  return typeof value === 'string' ? value : undefined;
}

function snapshotRecord(snapshot: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = snapshot[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function recordNumber(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function publishEngineDebug(context: Context, candidates: CandidateAction[], deck: RecommendationDeck): void {
  window.dispatchEvent(new CustomEvent('engine_debug_update', {
    detail: { context, candidates, suggestion: deck.primary ?? null, deck },
  }));
}

function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent('show_toast', { detail: message }));
}

function handleMicroActionIntent(intent: unknown): void {
  switch (intent) {
    case 'add_task':
      window.dispatchEvent(new Event('open_task_modal'));
      return;
    case 'add_habit':
      window.dispatchEvent(new Event('open_habit_modal'));
      return;
    case 'add_calendar_block':
      window.dispatchEvent(new Event('open_calendar_block_modal'));
      return;
    case 'open_tasks':
    case 'review_tasks':
      window.dispatchEvent(new Event('navigate_tasks'));
      return;
    case 'open_habits':
      window.dispatchEvent(new Event('navigate_habits'));
      return;
    case 'open_calendar':
      window.dispatchEvent(new Event('navigate_calendar'));
      return;
    case 'open_review':
      window.dispatchEvent(new Event('navigate_review'));
      return;
    case 'open_needs_profile':
      window.dispatchEvent(new Event('open_recommendation_profile'));
      return;
    case 'open_quick_log':
    case 'log_state':
    case 'log_water':
    case 'log_movement':
    case 'log_rest':
      window.dispatchEvent(new Event('open_quick_log'));
      return;
    case 'plan_day':
      window.dispatchEvent(new Event('navigate_dashboard'));
      return;
    default:
      window.dispatchEvent(new Event('navigate_dashboard'));
      showToast('Recommendation action opened on the dashboard.');
  }
}

function asAlternative(suggestion: Suggestion): Suggestion {
  return {
    ...suggestion,
    status: 'ignored',
    contextSnapshot: {
      ...suggestion.contextSnapshot,
      isAlternative: true,
    },
  };
}

function getEnergySupport(context: Context | null, suggestion: Suggestion): string | null {
  if (context?.lastEnergyValue === null || context?.lastEnergyValue === undefined) return null;

  const scoreBreakdown = snapshotRecord(suggestion.contextSnapshot, 'scoreBreakdown');
  const energyFitScore = Math.abs(recordNumber(scoreBreakdown, 'userEnergyFitScore'));
  const explanationUsesEnergy = /energy level/i.test(suggestion.reason);
  if (!explanationUsesEnergy && energyFitScore < 5) return null;

  return `ENERGY: ${context.lastEnergyValue}/5`;
}

export default function NowWhatCard() {
  const [deck, setDeck] = useState<RecommendationDeck | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [debugCandidates, setDebugCandidates] = useState<CandidateAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [computingStep, setComputingStep] = useState(0);
  const [resolvingHeight, setResolvingHeight] = useState<number | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const generatingRef = useRef(false);
  const actionInFlightRef = useRef(false);
  const lastGeneratedAtRef = useRef(0);

  const applyEngineResult = useCallback((result: EngineResult) => {
    lastGeneratedAtRef.current = Date.now();
    setDeck(result.deck);
    setContext(result.context);
    setDebugCandidates(result.candidates);
    publishEngineDebug(result.context, result.candidates, result.deck);
  }, []);

  const beginResolving = useCallback((): number => {
    const height = cardRef.current?.getBoundingClientRect().height;
    if (height && Number.isFinite(height)) setResolvingHeight(Math.ceil(height));
    setLoading(true);
    return Date.now();
  }, []);

  const generate = useCallback(async (showLoading = true) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    const startedAt = showLoading ? beginResolving() : Date.now();

    try {
      const result = await generateRecommendationDeckWithDebugInfo();
      if (showLoading) await waitForResolvingFrame(startedAt);
      applyEngineResult(result);
    } catch (err) {
      console.error('[nowwhat] generation failed:', err);
    } finally {
      if (showLoading) setLoading(false);
      generatingRef.current = false;
    }
  }, [applyEngineResult, beginResolving]);

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
    const refreshIfStale = () => {
      if (Date.now() - lastGeneratedAtRef.current >= 60_000) generate(false);
    };
    const handleFocus = () => refreshIfStale();
    const handleVisibility = () => {
      if (!document.hidden) refreshIfStale();
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

  const handleAccept = async () => {
    const activeSuggestion = deck?.primary;
    if (!activeSuggestion || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    const startedAt = beginResolving();

    try {
      await acceptSuggestion(activeSuggestion.id);

      const { actionType, targetId } = activeSuggestion;
      let needsRegen = true;

      if (actionType === 'micro_action') {
        handleMicroActionIntent(activeSuggestion.contextSnapshot.actionIntent);
        needsRegen = false;
      } else if (actionType === 'start_task') {
        window.dispatchEvent(new CustomEvent('focus_task', { detail: { taskId: targetId } }));
        showToast('Task opened in the task list.');
        needsRegen = false;
      } else if (
        actionType === 'log_water' ||
        actionType === 'log_meal' ||
        actionType === 'rest' ||
        actionType === 'move' ||
        actionType === 'begin_focus'
      ) {
        window.dispatchEvent(new Event('open_quick_log'));
        needsRegen = false;
      } else if (actionType === 'complete_habit' && targetId) {
        const habit = await db.habits.get(targetId);
        if (habit) {
          if (habit.completionType === 'boolean') {
            await completeHabit(habit.id);
            await completeSuggestion(activeSuggestion.id);
            showToast(`Habit "${habit.name}" marked complete.`);
          } else {
            window.dispatchEvent(new Event('navigate_habits'));
            showToast(`Open "${habit.name}" to log its value.`);
            needsRegen = false;
          }
        }
      } else if (actionType === 'review_day') {
        window.dispatchEvent(new Event('navigate_review'));
        if (activeSuggestion.command === 'COMPLETE REVIEW') {
          setTimeout(() => window.dispatchEvent(new Event('navigate_review_yesterday')), 80);
        }
        needsRegen = false;
      } else if (actionType === 'plan_tomorrow') {
        window.dispatchEvent(new Event('navigate_dashboard'));
        needsRegen = false;
      } else if (actionType === 'clear_state') {
        showToast('No pending action.');
        needsRegen = false;
      } else if (actionType === 'acknowledge_block') {
        window.dispatchEvent(new Event('navigate_calendar'));
        needsRegen = false;
      }

      if (needsRegen) {
        applyEngineResult(await generateRecommendationDeckWithDebugInfo());
      }
    } catch (err) {
      console.error('[nowwhat] accept failed:', err);
      showToast('Recommendation action could not be completed.');
    } finally {
      await waitForResolvingFrame(startedAt);
      setLoading(false);
      actionInFlightRef.current = false;
    }
  };

  const handleDismiss = async () => {
    const activeSuggestion = deck?.primary;
    if (!activeSuggestion || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    const startedAt = beginResolving();

    try {
      await dismissSuggestion(activeSuggestion.id);
      applyEngineResult(await generateRecommendationDeckWithDebugInfo());
    } catch (err) {
      console.error('[nowwhat] dismiss failed:', err);
      showToast('Recommendation could not be dismissed.');
    } finally {
      await waitForResolvingFrame(startedAt);
      setLoading(false);
      actionInFlightRef.current = false;
    }
  };

  const handleSelectAlternative = async (alternative: Suggestion) => {
    if (!deck?.primary || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    const startedAt = beginResolving();

    try {
      const previousPrimary = deck.primary;
      const active = await persistAlternativeSuggestion(alternative);
      const selectedIdentity = snapshotString(active.contextSnapshot, 'selectedCandidateIdentity') ?? null;
      const remainingAlternatives = deck.alternatives.filter(item => item.id !== alternative.id);
      const alternatives = [asAlternative(previousPrimary), ...remainingAlternatives].slice(0, 2);
      const nextDebug = deck.debug?.map(item => ({
        ...item,
        selected: item.candidateIdentity === selectedIdentity,
      }));
      const nextDeck: RecommendationDeck = {
        ...deck,
        primary: active,
        alternatives,
        supportText: snapshotString(active.contextSnapshot, 'supportText') ?? deck.supportText,
        debug: nextDebug,
      };
      const nextContext = context
        ? { ...context, selectedCandidateIdentity: selectedIdentity }
        : null;
      const nextCandidates = debugCandidates.map(candidate => ({
        ...candidate,
        scoreBreakdown: candidate.scoreBreakdown
          ? { ...candidate.scoreBreakdown, selected: candidate.identity === selectedIdentity }
          : undefined,
      }));

      setDeck(nextDeck);
      setContext(nextContext);
      setDebugCandidates(nextCandidates);
      if (nextContext) publishEngineDebug(nextContext, nextCandidates, nextDeck);
    } catch (err) {
      console.error('[nowwhat] alternative selection failed:', err);
      showToast('Alternative recommendation could not be selected.');
    } finally {
      await waitForResolvingFrame(startedAt);
      setLoading(false);
      actionInFlightRef.current = false;
    }
  };

  if (loading) {
    return (
      <section
        ref={cardRef}
        className="nowwhat-card nowwhat-resolving"
        style={{ minHeight: `${resolvingHeight ?? 180}px` }}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="mono nowwhat-compute" role="status">
          {COMPUTING_MESSAGES[computingStep]}
        </div>
      </section>
    );
  }

  const primary = deck?.primary;
  if (!deck || !primary) return null;

  const noContextState = deck.state === 'no_context';
  const emptyState = deck.state === 'empty';
  const cooldownState = deck.state === 'cooldown';
  const energySupport = getEnergySupport(context, primary);
  const pendingSupport = cooldownState && (deck.pendingCount ?? 0) > 0
    ? `${deck.pendingCount} pending task${deck.pendingCount === 1 ? '' : 's'} available.`
    : null;
  const criticalSupport = deck.supportText && deck.supportText !== primary.reason
    ? deck.supportText
    : null;

  return (
    <section
      ref={cardRef}
      className="nowwhat-card"
      aria-labelledby="nowwhat-primary-command"
      aria-live="polite"
    >
      <div className="nowwhat-card-header">
        <div className="label">NOW_WHAT?</div>
        <button
          type="button"
          onClick={() => generate()}
          className="mono nowwhat-regenerate"
          aria-label="Regenerate recommendations"
        >
          [REGENERATE]
        </button>
      </div>

      <div className="nowwhat-primary">
        <h2 id="nowwhat-primary-command" className="mono nowwhat-primary-command">
          {primary.command}
        </h2>
        <div className="mono nowwhat-primary-target">
          {primary.targetLabel}
        </div>
        <div className="nowwhat-primary-reason">
          {primary.reason}
        </div>
        {energySupport && <div className="mono nowwhat-energy-support">{energySupport}</div>}
        {pendingSupport && <div className="mono nowwhat-factual-support">{pendingSupport}</div>}
      </div>

      <div className="nowwhat-actions" role="group" aria-label="Primary recommendation actions">
        {noContextState ? (
          <>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open_task_modal'))}
              className="mono nowwhat-action-primary"
            >
              [ADD TASK]
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open_habit_modal'))}
              className="mono nowwhat-action-secondary"
            >
              [ADD HABIT]
            </button>
          </>
        ) : emptyState ? (
          <>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open_task_modal'))}
              className="mono nowwhat-action-primary"
            >
              [ADD TASK]
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open_quick_log'))}
              className="mono nowwhat-action-secondary"
            >
              [QUICK LOG]
            </button>
          </>
        ) : cooldownState ? (
          <>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('navigate_tasks'))}
              className="mono nowwhat-action-primary"
            >
              [VIEW TASKS]
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open_task_modal'))}
              className="mono nowwhat-action-secondary"
            >
              [ADD TASK]
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleAccept}
              className="mono nowwhat-action-primary"
              aria-label="Accept primary recommendation"
            >
              {primary.actionType === 'acknowledge_block' ? '[OPEN CALENDAR]' : '[ACCEPT]'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="mono nowwhat-action-secondary"
              aria-label="Dismiss primary recommendation"
            >
              [DISMISS]
            </button>
          </>
        )}
      </div>

      {deck.alternatives.length > 0 && (
        <section className="nowwhat-alternatives" aria-label="Alternative recommendations">
          <div className="label">ALTERNATIVES</div>
          <div className="nowwhat-alternatives-grid">
            {deck.alternatives.slice(0, 2).map(alternative => (
              <article key={alternative.id} className="nowwhat-alternative">
                <h3 className="mono nowwhat-alternative-command">{alternative.command}</h3>
                <div className="mono nowwhat-alternative-target">{alternative.targetLabel}</div>
                <div className="nowwhat-alternative-reason">{alternative.reason}</div>
                <button
                  type="button"
                  onClick={() => handleSelectAlternative(alternative)}
                  className="mono nowwhat-select-alternative"
                  aria-label={`Select alternative: ${alternative.command}`}
                >
                  [SELECT]
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {criticalSupport && (
        <div className="mono nowwhat-critical-support">{criticalSupport}</div>
      )}
    </section>
  );
}
