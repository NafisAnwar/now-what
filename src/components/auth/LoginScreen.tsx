import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Please open http://localhost:5173');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        // Silent
      } else {
        setError(err?.message || 'Google sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err?.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--body)] flex flex-col justify-center items-center p-4">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="mono text-2xl font-bold tracking-wider text-[var(--white)] mb-2">
            NOW_WHAT?
          </h1>
          <p className="text-xs text-[var(--dim)] mono uppercase tracking-widest">
            Personal Daily Command System
          </p>
        </div>

        {/* Auth Method Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-[var(--bg-subtle)] p-1 rounded-lg mb-6 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => { setAuthMethod('google'); setError(null); }}
            className={`py-2 px-3 text-xs font-mono rounded-md transition-all flex items-center justify-center gap-2 ${
              authMethod === 'google'
                ? 'bg-[var(--surface)] text-[var(--white)] shadow border border-[var(--border)] font-semibold'
                : 'text-[var(--dim)] hover:text-[var(--body)]'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google Sign-In
          </button>

          <button
            type="button"
            onClick={() => { setAuthMethod('email'); setError(null); }}
            className={`py-2 px-3 text-xs font-mono rounded-md transition-all flex items-center justify-center gap-2 ${
              authMethod === 'email'
                ? 'bg-[var(--surface)] text-[var(--white)] shadow border border-[var(--border)] font-semibold'
                : 'text-[var(--dim)] hover:text-[var(--body)]'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
            Email & Password
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign In View */}
        {authMethod === 'google' && (
          <div className="space-y-4 text-center py-2">
            <p className="text-xs text-[var(--dim)] mb-4">
              Sign in with your Google account to sync tasks, habits, and preferences.
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold py-3 px-4 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-3 border border-gray-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>
          </div>
        )}

        {/* Email & Password Form */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--dim)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--white)] placeholder-[var(--dim)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--dim)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--white)] placeholder-[var(--dim)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover,#3b82f6)] text-white font-mono text-xs uppercase font-semibold py-3 px-4 rounded-lg transition-all shadow flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Processing...</span>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-xs text-[var(--dim)] hover:text-[var(--accent)] font-mono transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-[var(--border)] text-center text-[10px] text-[var(--dim)] mono">
          Local Data + Cloud Storage Encrypted
        </div>
      </div>
    </div>
  );
};
