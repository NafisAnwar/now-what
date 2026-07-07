import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import TutorialSection from './TutorialSection';
import { markTutorialCompleted, markTutorialPromptSeen } from '../../data/tutorial';

const listStyle: React.CSSProperties = {
  marginLeft: '18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const codeStyle: React.CSSProperties = {
  color: 'var(--primary)',
  fontFamily: 'var(--mono)',
  fontSize: '12px',
};

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: '12px',
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="mono" style={{ color: 'var(--primary)', fontSize: '12px' }}>{keys}</span>
      <span style={{ color: 'var(--body)' }}>{label}</span>
    </div>
  );
}

export default function TutorialPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    markTutorialPromptSeen().catch(console.error);
  }, []);

  const finishGuide = async () => {
    await markTutorialCompleted();
    navigate('/');
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 0 80px' }}>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          paddingBottom: '18px',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div className="mono label" style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '8px' }}>
            QUICK START GUIDE
          </div>
          <div style={{ color: 'var(--secondary)', fontSize: '13px', lineHeight: 1.6, maxWidth: '680px' }}>
            A factual guide to the NOW_WHAT? command surface, local data model, daily planning flow,
            logs, reviews, reminders, backup, and shortcuts.
          </div>
        </div>
        <button
          type="button"
          onClick={finishGuide}
          className="mono"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border-hi)',
            color: 'var(--white)',
            fontSize: '12px',
            padding: '8px 14px',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          [DONE]
        </button>
      </header>

      <TutorialSection index="01" title="What NOW_WHAT? Is">
        <p>NOW_WHAT? is a local-first daily command system.</p>
        <p>
          It helps track commitments, log activity, review the day, and choose the next action.
          It is not a social app, gamified habit app, or motivational coach.
        </p>
        <p>Data is stored locally in this browser/device unless you export it.</p>
      </TutorialSection>

      <TutorialSection index="02" title="Core Loop">
        <p><span style={codeStyle}>PLAN -&gt; ACT -&gt; LOG -&gt; REFLECT -&gt; NOW_WHAT?</span></p>
        <ul style={listStyle}>
          <li>Plan tasks, habits, goals, and calendar blocks.</li>
          <li>Act by completing tasks/habits or following NOW_WHAT?.</li>
          <li>Log water, focus, meals, movement, mood, energy, rest, distraction, and notes.</li>
          <li>Reflect using Daily Review and Weekly Review.</li>
          <li>Use NOW_WHAT? to choose the next action.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="03" title="Dashboard">
        <ul style={listStyle}>
          <li>Dashboard is the command surface.</li>
          <li>The NOW_WHAT? card is the primary action area.</li>
          <li>Daily Plan shows today's focus and planned items.</li>
          <li>Calendar Strip shows time blocks.</li>
          <li>Lifestyle Strip shows context from logs.</li>
          <li>Goal Strip shows active goal context.</li>
          <li>Activity Feed shows recent actions.</li>
          <li>Reminder Tray appears only when reminders are due.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="04" title="NOW_WHAT?">
        <p>
          NOW_WHAT? uses rule-based, explainable logic. It considers tasks, deadlines, habits,
          daily plan, goals, calendar blocks, mood/energy/focus context, reminders, and review status.
        </p>
        <p>It does not use AI/ML in the Hero Version.</p>
        <ul style={listStyle}>
          <li><span style={codeStyle}>REGENERATE</span> recalculates the next action.</li>
          <li><span style={codeStyle}>ACCEPT</span> follows or starts the suggested action.</li>
          <li><span style={codeStyle}>DISMISS</span> ignores the current suggestion and asks for another valid option.</li>
          <li>If no tasks/actions exist, it shows an empty state like <span style={codeStyle}>NO AVAILABLE TASKS</span>.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="05" title="Tasks">
        <p>Use Tasks for one-time or repeatable commitments.</p>
        <p>
          Fields include title, priority, category, energy requirement, estimate, due date/time,
          notes, repeat behavior, and optional goal link.
        </p>
        <ul style={listStyle}>
          <li>Completing a task adds it to the Activity Timeline.</li>
          <li>Planned tasks are prioritized over unplanned tasks when urgency is similar.</li>
          <li>Goal-linked tasks can influence NOW_WHAT? reasoning.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="06" title="Habits">
        <p>Use Habits for recurring routines.</p>
        <ul style={listStyle}>
          <li>Habits can be boolean, quantity-based, time-based, or count-based.</li>
          <li>Habit time windows can trigger reminders and NOW_WHAT? suggestions.</li>
          <li>Completing a habit logs activity and feeds reviews.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="07" title="Goals">
        <p>Use Goals to give tasks and habits long-term direction.</p>
        <ul style={listStyle}>
          <li>Goals can be active, paused, or complete.</li>
          <li>Progress is derived from linked tasks and habits.</li>
          <li>No fake progress sliders are used.</li>
          <li>Paused/completed goals should not boost NOW_WHAT?.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="08" title="Daily Plan">
        <p>Daily Plan is today's operating structure.</p>
        <ul style={listStyle}>
          <li>Set a primary focus.</li>
          <li>Plan tasks, habits, and calendar blocks for the day.</li>
          <li>Carry-over moves unfinished work forward as a neutral action.</li>
          <li>Daily Plan feeds NOW_WHAT?, reminders, dashboard, and review.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="09" title="Calendar">
        <ul style={listStyle}>
          <li>Calendar blocks are read-only time context.</li>
          <li>Calendar blocks are not tasks and are not completed.</li>
          <li>Manual blocks and <span style={codeStyle}>.ics</span> import are supported.</li>
          <li>Google/Apple calendar connection is reserved for later if placeholders exist.</li>
          <li>A calendar block can be converted into a task when action is required.</li>
          <li>Calendar blocks help NOW_WHAT? understand available time.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="10" title="Quick Log">
        <p>Quick Log is for fast activity capture.</p>
        <p>
          Available logs include water, meal, focus, exercise/movement, mood, energy,
          rest, distraction, and note.
        </p>
        <p>Logs update Lifestyle Context, Timeline, Reviews, and NOW_WHAT?.</p>
      </TutorialSection>

      <TutorialSection index="11" title="Timeline">
        <p>Timeline is the factual record of the day.</p>
        <p>
          It includes task completions, habit completions, quick logs, calendar context,
          reminders/actions where applicable, and notes.
        </p>
        <ul style={listStyle}>
          <li>Rest = intentional recovery.</li>
          <li>Distraction = unintentional time loss.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="12" title="Focus / Mood / Energy">
        <p>Mood and energy are used as operational context.</p>
        <ul style={listStyle}>
          <li>They help NOW_WHAT? choose a task that fits current capacity.</li>
          <li>Low energy may favor short or low-friction tasks.</li>
          <li>Clear/high energy may favor deeper planned work.</li>
          <li>The app does not diagnose or provide therapy.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="13" title="Reviews">
        <ul style={listStyle}>
          <li>Daily Review summarizes what happened today.</li>
          <li>Weekly Review summarizes patterns.</li>
          <li>Reviews are factual and observational.</li>
          <li>Carry-over actions help move tasks forward.</li>
          <li>Missed, skip, and carry actions are neutral status choices.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="14" title="Reminders">
        <p>Reminders are quiet and user-controlled.</p>
        <ul style={listStyle}>
          <li>In-app reminders can appear for task due times, habit windows, calendar blocks, reviews, hydration, and movement.</li>
          <li>Browser notifications require explicit opt-in.</li>
          <li>Quiet hours can suppress reminders.</li>
          <li>Reminders are action-specific, not motivational.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="15" title="Data / Backup">
        <ul style={listStyle}>
          <li>Data is stored locally.</li>
          <li>Export backup saves all app data to JSON.</li>
          <li>Import restores from a backup.</li>
          <li>Integrity checks look for broken references.</li>
          <li>Danger Zone can clear local data, clear suggestions, or reset demo data.</li>
          <li>Full clear makes the first-run tutorial prompt appear again.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="16" title="PWA / Offline">
        <ul style={listStyle}>
          <li>The app can work offline after first load.</li>
          <li>Install support exists through PWA behavior.</li>
          <li>The visible install button may currently be hidden, but browser install may still be available.</li>
          <li>Data remains local to the browser/device.</li>
        </ul>
      </TutorialSection>

      <TutorialSection index="17" title="Keyboard Shortcuts">
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <ShortcutRow keys="T" label="Add task" />
          <ShortcutRow keys="H" label="Add habit" />
          <ShortcutRow keys="G" label="Add goal" />
          <ShortcutRow keys="L" label="Quick log" />
          <ShortcutRow keys="N" label="Regenerate NOW_WHAT?" />
          <ShortcutRow keys="Shift + N" label="Engine debug panel" />
          <ShortcutRow keys="Esc" label="Close modal" />
        </div>
      </TutorialSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px' }}>
        <button
          type="button"
          onClick={finishGuide}
          className="mono"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border-hi)',
            color: 'var(--white)',
            fontSize: '12px',
            padding: '8px 16px',
            textTransform: 'uppercase',
          }}
        >
          [DONE]
        </button>
      </div>
    </div>
  );
}
