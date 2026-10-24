import React, { useEffect, useState } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import AppShell from './components/layout/AppShell';
import Dashboard from './components/dashboard/Dashboard';
import TasksPage from './components/tasks/TasksPage';
import CalendarPage from './components/calendar/CalendarPage';
import WorkoutsPage from './components/workouts/WorkoutsPage';
import ChatPage from './components/chat/ChatPage';
import DataPage from './components/data/DataPage';
import TutorialPage from './components/tutorial/TutorialPage';
import TutorialPrompt from './components/tutorial/TutorialPrompt';
import { initializeProfileSession } from './data/profile';
import TaskModal from './components/tasks/TaskModal';
import WorkoutModal from './components/workouts/WorkoutModal';
import CalendarBlockModal from './components/calendar/CalendarBlockModal';
import QuickLogModal from './components/quicklog/QuickLogModal';
import { ToastProvider } from './components/ui/Toast';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { VerifyEmailScreen } from './components/auth/VerifyEmailScreen';

/** Lives inside WouterRouter so it can call useLocation */
function NavigationHandler() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const handleFocusTask = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId) sessionStorage.setItem('nowwhat:focus-task', taskId);
      navigate('/tasks');
    };
    const handleNavigateTasks = () => navigate('/tasks');
    const handleNavigateCalendar = () => navigate('/calendar');
    const handleNavigateDashboard = () => navigate('/');
    window.addEventListener('focus_task', handleFocusTask);
    window.addEventListener('navigate_tasks', handleNavigateTasks);
    window.addEventListener('navigate_calendar', handleNavigateCalendar);
    window.addEventListener('navigate_dashboard', handleNavigateDashboard);
    return () => {
      window.removeEventListener('focus_task', handleFocusTask);
      window.removeEventListener('navigate_tasks', handleNavigateTasks);
      window.removeEventListener('navigate_calendar', handleNavigateCalendar);
      window.removeEventListener('navigate_dashboard', handleNavigateDashboard);
    };
  }, [navigate]);
  return null;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[app] render failed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px', background: 'var(--bg)' }}>
        <div className="mono" style={{ color: 'var(--body)', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>THE APP COULD NOT RENDER THIS VIEW.</div>
          <button type="button" onClick={() => window.location.reload()} className="mono">
            [RELOAD]
          </button>
        </div>
      </div>
    );
  }
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
        <Route path="/guide" component={TutorialPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/workouts" component={WorkoutsPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/data" component={DataPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

export default function App() {
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isCalendarBlockModalOpen, setIsCalendarBlockModalOpen] = useState(false);
  const [isQuickLogModalOpen, setIsQuickLogModalOpen] = useState(false);

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations()
          .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
          .catch(err => console.log('[sw] dev unregister skipped:', err.message));
        return;
      }

      const swUrl = import.meta.env.BASE_URL + 'service-worker.js';
      navigator.serviceWorker.register(swUrl).catch(() => undefined);
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


  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement
        ? target
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (!element) return false;
      const tagName = element.tagName;
      return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        element.isContentEditable ||
        Boolean(element.closest('[contenteditable="true"]'))
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 't') {
        e.preventDefault();
        setIsTaskModalOpen(true);
      } else if (key === 'w') {
        e.preventDefault();
        setIsWorkoutModalOpen(true);
      } else if (key === 'l') {
        e.preventDefault();
        setIsQuickLogModalOpen(true);
      }
    };

    const handleOpenTask = () => setIsTaskModalOpen(true);
    const handleOpenWorkout = () => setIsWorkoutModalOpen(true);
    const handleOpenCalendarBlock = () => setIsCalendarBlockModalOpen(true);
    const handleOpenQuickLog = () => setIsQuickLogModalOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open_task_modal', handleOpenTask);
    window.addEventListener('open_workout_modal', handleOpenWorkout);
    window.addEventListener('open_calendar_block_modal', handleOpenCalendarBlock);
    window.addEventListener('open_quick_log', handleOpenQuickLog);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open_task_modal', handleOpenTask);
      window.removeEventListener('open_workout_modal', handleOpenWorkout);
      window.removeEventListener('open_calendar_block_modal', handleOpenCalendarBlock);
      window.removeEventListener('open_quick_log', handleOpenQuickLog);
    };
  }, []);

  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="mono" style={{ color: 'var(--dim)', fontSize: '14px', letterSpacing: '0.1em' }}>
          [LOADING AUTHENTICATION...]
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // If signed in with email/password and email is not verified yet, require verification
  const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
  if (isPasswordProvider && !user.emailVerified) {
    return <VerifyEmailScreen />;
  }

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
      <AppErrorBoundary>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <NavigationHandler />
          <AppShell>
            <Router />
          </AppShell>
          <TutorialPrompt />
        </WouterRouter>
        {isTaskModalOpen && <TaskModal onClose={() => setIsTaskModalOpen(false)} />}
        {isWorkoutModalOpen && <WorkoutModal onClose={() => setIsWorkoutModalOpen(false)} />}
        {isCalendarBlockModalOpen && (
          <CalendarBlockModal onClose={() => setIsCalendarBlockModalOpen(false)} />
        )}
        {isQuickLogModalOpen && <QuickLogModal onClose={() => setIsQuickLogModalOpen(false)} />}
      </AppErrorBoundary>
    </ToastProvider>
  );
}
