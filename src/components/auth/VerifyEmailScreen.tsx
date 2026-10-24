import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, CheckCircle2, RefreshCw, LogOut, AlertCircle } from 'lucide-react';

export const VerifyEmailScreen: React.FC = () => {
  const { user, resendVerification, checkVerificationStatus, logout } = useAuth();
  
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setError(null);
    setChecking(true);
    try {
      const isVerified = await checkVerificationStatus();
      if (!isVerified) {
        setError('Email is not verified yet. Please check your inbox and click the link.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to check verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResent(false);
    try {
      await resendVerification();
      setResent(true);
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a minute before requesting another link.');
      } else {
        setError(err?.message || 'Failed to send verification email.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--body)] flex flex-col justify-center items-center p-4">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 shadow-2xl relative z-10 text-center">
        {/* Icon & Branding */}
        <div className="w-14 h-14 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl flex items-center justify-center mx-auto mb-5 text-[var(--accent)]">
          <Mail className="w-7 h-7" />
        </div>

        <h2 className="mono text-xl font-bold text-[var(--white)] mb-2">
          Verify Your Email
        </h2>

        <p className="text-xs text-[var(--dim)] mb-6 leading-relaxed">
          We sent a verification link to <br />
          <span className="text-[var(--white)] font-semibold">{user?.email}</span>. <br />
          Please verify your email address to unlock your command dashboard.
        </p>

        {/* Status & Error Alerts */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resent && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5 text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>New verification email sent! Check your inbox or spam folder.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover,#3b82f6)] text-white font-mono text-xs uppercase font-semibold py-3 px-4 rounded-lg transition-all shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{checking ? 'Checking Status...' : "I've Verified My Email"}</span>
          </button>

          <button
            type="button"
            onClick={handleResend}
            className="w-full bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--body)] font-mono text-xs uppercase font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Resend Verification Link</span>
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-[var(--border)] flex justify-center">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-[var(--dim)] hover:text-red-400 font-mono transition-colors flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out & use another account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
