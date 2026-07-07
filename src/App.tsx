import React, { useEffect, useState } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import AppShell from './components/layout/AppShell';
import Dashboard from './components/dashboard/Dashboard';
import TasksPage from './components/tasks/TasksPage';
import HabitsPage from './components/habits/HabitsPage';
import GoalsPage from './components/goals/GoalsPage';
import Timeline from './components/timeline/Timeline';
import CalendarPage from './components/calendar/CalendarPage';
import DailyReviewPage from './components/review/DailyReviewPage';
import DataPage from './components/data/DataPage';
import RemindersPage from './components/reminders/RemindersPage';
import { generateSystemRemindersForToday } from './data/reminders';
import { initializeProfileSession } from './data/profile';
import TaskModal from './components/tasks/TaskModal';
import HabitModal from './components/habits/HabitModal';
import GoalModal from './components/goals/GoalModal';
import QuickLogModal from './components/quicklog/QuickLogModal';
import EngineDebugPanel from './components/debug/EngineDebugPanel';
import { ToastProvider } from './components/ui/Toast';
import type { Context, CandidateAction } from './engine/nowWhat';
import type { Suggestion } from './types';

/** Lives inside WouterRouter so it can call useLocation */
function NavigationHandler() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const handleFocusTask = () => navigate('/tasks');
    const handleNavigateReview = () => navigate('/review');
    window.addEventListener('focus_task', handleFocusTask);
    window.addEventListener('navigate_review', handleNavigateReview);
    return () => {
      window.removeEventListener('focus_task', handleFocusTask);
      window.removeEventListener('navigate_review', handleNavigateReview);
    };
  }, [navigate]);
  return null;
}

interface DebugData {
  context: Context | null;
  candidates: CandidateAction[];
  suggestion: Suggestion | null;
}

function NotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="mono" style={{ color: 'var(--dim)' }}>404 | NOT FOUND</div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();

  return (
    <div key={location} className="route-transition">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/habits" component={HabitsPage} />
        <Route path="/goals" component={GoalsPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/review" component={DailyReviewPage} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/data" component={DataPage} />
        <Route path="/reminders" component={RemindersPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

export default function App() {
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isQuickLogModalOpen, setIsQuickLogModalOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const swUrl = import.meta.env.BASE_URL + 'service-worker.js';
      navigator.serviceWorker.register(swUrl)
        .then(reg => console.log('[sw] registered, scope:', reg.scope))
        .catch(err => console.log('[sw] registration skipped:', err.message));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    initializeProfileSession()
      .then(() => {
        if (!cancelled) setIsProfileReady(true);
      })
      .catch(err => {
        console.error('[profile] boot failed:', err);
        if (!cancelled) setBootError('Profile boot failed.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reminder scheduler: run after profile boot, every 5 min, and on engine regen events
  useEffect(() => {
    if (!isProfileReady) return;
    generateSystemRemindersForToday().catch(console.error);
    const interval = setInterval(() => {
      generateSystemRemindersForToday().catch(console.error);
    }, 5 * 60 * 1000);
    const handleRegen = () => generateSystemRemindersForToday().catch(console.error);
    window.addEventListener('regenerate_now_what', handleRegen);
    return () => {
      clearInterval(interval);
      window.removeEventListener('regenerate_now_what', handleRegen);
    };
  }, [isProfileReady]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'SELECT') {
        return;
      }

      if (e.shiftKey && e.key === 'N') {
        setDebugOpen(prev => !prev);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 't') setIsTaskModalOpen(true);
      else if (key === 'h') setIsHabitModalOpen(true);
      else if (key === 'g') window.dispatchEvent(new Event('open_goal_modal'));
      else if (key === 'l') setIsQuickLogModalOpen(true);
      else if (key === 'n') {
        window.dispatchEvent(new Event('regenerate_now_what'));
      }
    };

    const handleOpenTask = () => setIsTaskModalOpen(true);
    const handleOpenHabit = () => setIsHabitModalOpen(true);
    const handleOpenGoal = () => setIsGoalModalOpen(true);
    const handleOpenQuickLog = () => setIsQuickLogModalOpen(true);

    const handleDebugUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<DebugData>;
      setDebugData(customEvent.detail);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open_task_modal', handleOpenTask);
    window.addEventListener('open_habit_modal', handleOpenHabit);
    window.addEventListener('open_goal_modal', handleOpenGoal);
    window.addEventListener('open_quick_log', handleOpenQuickLog);
    window.addEventListener('engine_debug_update', handleDebugUpdate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open_task_modal', handleOpenTask);
      window.removeEventListener('open_habit_modal', handleOpenHabit);
      window.removeEventListener('open_goal_modal', handleOpenGoal);
      window.removeEventListener('open_quick_log', handleOpenQuickLog);
      window.removeEventListener('engine_debug_update', handleDebugUpdate);
    };
  }, []);

  if (bootError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="mono" style={{ color: 'var(--dim)' }}>{bootError}</div>
      </div>
    );
  }

  if (!isProfileReady) return null;

  return (
    <ToastProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <NavigationHandler />
        <AppShell>
          <Router />
        </AppShell>
      </WouterRouter>
      {isTaskModalOpen && <TaskModal onClose={() => setIsTaskModalOpen(false)} />}
      {isHabitModalOpen && <HabitModal onClose={() => setIsHabitModalOpen(false)} />}
      {isGoalModalOpen && <GoalModal onClose={() => setIsGoalModalOpen(false)} />}
      {isQuickLogModalOpen && <QuickLogModal onClose={() => setIsQuickLogModalOpen(false)} />}
      {debugOpen && debugData && <EngineDebugPanel {...debugData} onClose={() => setDebugOpen(false)} />}
    </ToastProvider>
  );
}
