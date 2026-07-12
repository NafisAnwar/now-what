import React from 'react';
import {
  getTaskCategoryGroup,
  getTaskCategoryNeed,
  normalizeCategory,
  type TaskCategoryGroup,
} from '../../constants/categories';
import type { CandidateAction, Context } from '../../engine/nowWhat';
import { isHardRuleCandidate } from '../../engine/recommendationScoring';
import type { RecommendationDeck, Suggestion } from '../../types';

interface EngineDebugPanelProps {
  context: Context | null;
  candidates: CandidateAction[];
  suggestion: Suggestion | null;
  deck?: RecommendationDeck | null;
  onClose: () => void;
}

interface DebugFieldProps {
  label: string;
  value: React.ReactNode;
}

function DebugField({ label, value }: DebugFieldProps) {
  return (
    <div className="engine-debug-field">
      <span className="engine-debug-key">{label}</span>
      <span className="engine-debug-value">{value}</span>
    </div>
  );
}

function snapshotString(snapshot: Record<string, unknown> | undefined, key: string): string | null {
  const value = snapshot?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function suggestionIdentity(suggestion: Suggestion | undefined): string {
  if (!suggestion) return 'none';
  return snapshotString(suggestion.contextSnapshot, 'selectedCandidateIdentity') ??
    `${suggestion.actionType}:${suggestion.targetId ?? suggestion.id}`;
}

function scoreValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '--';
}

function candidateStatus(candidate: CandidateAction, selectedIdentity: string | null): string {
  if (candidate.identity === selectedIdentity || candidate.scoreBreakdown?.selected) return 'selected';
  if (candidate.cooldownReason || candidate.scoreBreakdown?.excludedReason) return 'excluded';
  return 'eligible';
}

function formatCooldownUntil(value: string | undefined): string {
  if (!value) return '--';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function categoryEffectLabel(group: TaskCategoryGroup): string {
  switch (group) {
    case 'school_work': return 'Needs Profile match';
    case 'health_energy': return 'Needs Profile + restless-state fit';
    case 'life_admin': return 'Needs Profile + low-energy/admin fit';
    case 'creative_projects': return 'Needs Profile + high-energy creative fit';
    case 'social': return 'neutral; grouping only';
    case 'unknown': return 'neutral; unrecognized/custom';
  }
}

export default function EngineDebugPanel({
  context,
  candidates,
  suggestion,
  deck,
  onClose,
}: EngineDebugPanelProps) {
  if (!context) return null;

  const selectedIdentity = context.selectedCandidateIdentity;
  const selectedCandidate = candidates.find(candidate => candidate.identity === selectedIdentity);
  const hardRuleActive = selectedCandidate ? isHardRuleCandidate(selectedCandidate, context) : false;
  const primaryIdentity = deck?.primary
    ? suggestionIdentity(deck.primary)
    : selectedIdentity ?? 'none';
  const alternativeIdentities = deck?.alternatives.map(alternative => suggestionIdentity(alternative)) ?? [];
  const cooldownCandidates = candidates.filter(candidate => candidate.cooldownReason || candidate.cooldownUntil);
  const scoredCandidates = candidates.filter(candidate => candidate.scoreBreakdown);

  const seenTaskIdentities = new Set<string>();
  const taskFitMatches = candidates.flatMap(candidate => {
    if (candidate.actionType !== 'start_task' || !candidate.targetId) return [];
    const identity = candidate.identity ?? candidate.targetId;
    if (seenTaskIdentities.has(identity)) return [];
    seenTaskIdentities.add(identity);
    const task = context.pendingTasks.find(item => item.id === candidate.targetId);
    if (!task) return [];
    const categoryGroup = getTaskCategoryGroup(task.category);
    const categoryNeed = getTaskCategoryNeed(task.category);
    return [{
      identity,
      requirement: task.energyRequired,
      fitScore: candidate.scoreBreakdown?.taskEnergyFitScore,
      rawCategory: task.category || '(empty)',
      normalizedCategory: normalizeCategory(task.category) || '(empty)',
      categoryGroup,
      profileAdjustment: categoryNeed && context.needsProfile.selectedNeeds.includes(categoryNeed) ? 7 : 0,
    }];
  });

  return (
    <aside className="engine-debug-panel" aria-label="NOW_WHAT engine debug panel">
      <header className="engine-debug-header">
        <div className="mono label" style={{ color: 'var(--primary)' }}>ENGINE DEBUG / V1.2</div>
        <button
          type="button"
          onClick={onClose}
          className="mono label engine-debug-close"
          aria-label="Close engine debug panel"
        >
          [X]
        </button>
      </header>

      <section className="engine-debug-section" aria-labelledby="engine-debug-context">
        <h2 id="engine-debug-context" className="mono engine-debug-section-title">CONTEXT</h2>
        <div className="engine-debug-grid">
          <DebugField label="hasUserContext" value={context.hasUserContext ? 'yes' : 'no'} />
          <DebugField label="hasReviewableActivityToday" value={context.hasReviewableActivityToday ? 'yes' : 'no'} />
          <DebugField label="currentState" value={context.latestMoodState} />
          <DebugField label="currentCapacity" value={context.currentFocusCapacity} />
          <DebugField label="latestMoodValue" value={context.lastMoodValue !== null ? `${context.lastMoodValue}/5` : '--'} />
          <DebugField label="latestEnergyValue" value={context.lastEnergyValue ?? '--'} />
          <DebugField label="latestUserEnergyLevel" value={context.lastEnergyValue !== null ? `${context.lastEnergyValue}/5` : '--'} />
          <DebugField label="latestEnergySignal" value={context.latestEnergyLevel ?? '--'} />
          <DebugField label="scoringEnergyBand" value={context.userEnergyBand ?? '--'} />
          <DebugField label="selectedNeeds" value={context.needsProfile.selectedNeeds.join(', ') || 'none'} />
          <DebugField label="priorityMode" value={context.needsProfile.priorityMode} />
          <DebugField label="lowEnergyPreference" value={context.needsProfile.lowEnergyPreference} />
          <DebugField label="checkInEnabled" value={context.needsProfile.checkInEnabled ? 'yes' : 'no'} />
          <DebugField label="activeCooldownCount" value={context.activeCooldownCount} />
          <DebugField label="selectedCandidateIdentity" value={selectedIdentity ?? 'none'} />
          <DebugField label="availableWindowMinutes" value={Math.round(context.availableWindowMinutes)} />
          <DebugField label="pendingTasks" value={context.pendingTasks.length} />
          <DebugField label="criticalOverdueTasks" value={context.criticalOverdueTasks.length} />
          <DebugField label="activeCalendarBlock" value={context.activeCalendarBlock?.title ?? 'none'} />
          <DebugField label="todayReviewAvailable" value={context.todayReviewAvailable ? 'yes' : 'no'} />
        </div>
      </section>

      <section className="engine-debug-section" aria-labelledby="engine-debug-deck">
        <h2 id="engine-debug-deck" className="mono engine-debug-section-title">RECOMMENDATION DECK</h2>
        <div className="engine-debug-grid">
          <DebugField label="deckState" value={deck?.state ?? 'unavailable'} />
          <DebugField label="primaryIdentity" value={primaryIdentity} />
          <DebugField label="alternativeIdentities" value={alternativeIdentities.join(', ') || 'none'} />
          <DebugField label="pendingCount" value={deck?.pendingCount ?? 0} />
          <DebugField label="supportText" value={deck?.supportText ?? '--'} />
          <DebugField label="primaryCommand" value={deck?.primary?.command ?? suggestion?.command ?? 'none'} />
        </div>
      </section>

      <section className="engine-debug-section" aria-labelledby="engine-debug-energy-fit">
        <h2 id="engine-debug-energy-fit" className="mono engine-debug-section-title">TASK ENERGY MATCHING</h2>
        {taskFitMatches.length === 0 ? (
          <div className="mono engine-debug-empty">No task candidates.</div>
        ) : (
          <div className="engine-debug-list">
            {taskFitMatches.map(match => (
              <div key={match.identity} className="mono engine-debug-list-row">
                <span>{match.identity}</span>
                <span>task={match.requirement}</span>
                <span>user={context.lastEnergyValue !== null ? `${context.lastEnergyValue}/5` : 'not logged'}</span>
                <span>fit={scoreValue(match.fitScore)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="engine-debug-section" aria-labelledby="engine-debug-category-fit">
        <h2 id="engine-debug-category-fit" className="mono engine-debug-section-title">TASK CATEGORY CONTEXT</h2>
        {taskFitMatches.length === 0 ? (
          <div className="mono engine-debug-empty">No task candidates.</div>
        ) : (
          <div className="engine-debug-list">
            {taskFitMatches.map(match => (
              <div key={match.identity} className="mono engine-debug-list-row">
                <span>{match.identity}</span>
                <span>raw={match.rawCategory}</span>
                <span>normalized={match.normalizedCategory}</span>
                <span>group={match.categoryGroup}</span>
                <span>profile={match.profileAdjustment > 0 ? `+${match.profileAdjustment}` : '0'}</span>
                <span>effect={categoryEffectLabel(match.categoryGroup)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="engine-debug-section" aria-labelledby="engine-debug-scores">
        <h2 id="engine-debug-scores" className="mono engine-debug-section-title">CANDIDATE SCORING</h2>
        {scoredCandidates.length === 0 ? (
          <div className="mono engine-debug-empty">No scored candidates.</div>
        ) : (
          <div className="engine-debug-table-wrap">
            <table className="mono engine-debug-score-table">
              <thead>
                <tr>
                  <th>identity</th>
                  <th>rule</th>
                  <th>action</th>
                  <th>target</th>
                  <th>base</th>
                  <th>urgency</th>
                  <th>needs</th>
                  <th>user energy</th>
                  <th>task energy</th>
                  <th>state</th>
                  <th>time</th>
                  <th>cooldown</th>
                  <th>variety</th>
                  <th>final</th>
                  <th>status</th>
                  <th>excluded reason</th>
                </tr>
              </thead>
              <tbody>
                {scoredCandidates.map((candidate, index) => {
                  const breakdown = candidate.scoreBreakdown;
                  if (!breakdown) return null;
                  const status = candidateStatus(candidate, selectedIdentity);
                  return (
                    <tr
                      key={candidate.identity ?? `${candidate.ruleName}-${index}`}
                      className={status === 'selected' ? 'is-selected' : status === 'excluded' ? 'is-excluded' : undefined}
                    >
                      <td>{candidate.identity ?? breakdown.candidateIdentity}</td>
                      <td>{candidate.ruleName}</td>
                      <td>{candidate.actionType}</td>
                      <td>{candidate.targetLabel}</td>
                      <td>{scoreValue(breakdown.baseScore)}</td>
                      <td>{scoreValue(breakdown.urgencyScore)}</td>
                      <td>{scoreValue(breakdown.needsScore)}</td>
                      <td>{scoreValue(breakdown.userEnergyFitScore)}</td>
                      <td>{scoreValue(breakdown.taskEnergyFitScore)}</td>
                      <td>{scoreValue(breakdown.stateFitScore)}</td>
                      <td>{scoreValue(breakdown.timeFitScore)}</td>
                      <td>{scoreValue(breakdown.cooldownPenalty)}</td>
                      <td>{scoreValue(breakdown.varietyPenalty)}</td>
                      <td>{scoreValue(breakdown.finalScore)}</td>
                      <td>{status}</td>
                      <td>{breakdown.excludedReason ?? candidate.cooldownReason ?? '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="engine-debug-section" aria-labelledby="engine-debug-cooldown">
        <h2 id="engine-debug-cooldown" className="mono engine-debug-section-title">COOLDOWN / OVERRIDES</h2>
        <div className="engine-debug-grid">
          <DebugField
            label="excludedCandidateIdentities"
            value={context.excludedCandidateIdentities.join(', ') || 'none'}
          />
          <DebugField
            label="hardRuleOverride"
            value={hardRuleActive ? `active (${selectedCandidate?.ruleName})` : 'inactive'}
          />
          <DebugField label="criticalSupportText" value={deck?.supportText ?? '--'} />
        </div>
        {cooldownCandidates.length > 0 && (
          <div className="engine-debug-list">
            {cooldownCandidates.map(candidate => (
              <div key={candidate.identity ?? candidate.ruleName} className="mono engine-debug-list-row">
                <span>{candidate.identity ?? candidate.ruleName}</span>
                <span>{candidate.cooldownReason ?? 'cooldown'}</span>
                <span>until={formatCooldownUntil(candidate.cooldownUntil)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {suggestion && (
        <section className="engine-debug-section" aria-labelledby="engine-debug-selected">
          <h2 id="engine-debug-selected" className="mono engine-debug-section-title">SELECTED SUGGESTION</h2>
          <div className="engine-debug-grid">
            <DebugField label="command" value={suggestion.command} />
            <DebugField label="actionType" value={suggestion.actionType} />
            <DebugField label="targetLabel" value={suggestion.targetLabel} />
            <DebugField label="identity" value={suggestionIdentity(suggestion)} />
            <DebugField label="stateAdjustmentApplied" value={selectedCandidate?.stateAffected ? 'yes' : 'no'} />
            <DebugField label="reason" value={suggestion.reason} />
          </div>
        </section>
      )}
    </aside>
  );
}
