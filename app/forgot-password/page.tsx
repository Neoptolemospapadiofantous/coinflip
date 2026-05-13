'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Mail, Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (authLoading || isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#020617' }}>
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    const result = await resetPassword(email);

    if (result.success) {
      setEmailSent(true);
    } else {
      setError(result.error || 'Failed to send reset email');
    }

    setIsLoading(false);
  };

  // Email sent confirmation screen
  if (emailSent) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm">
          <div
            className="w-full rounded-2xl p-8 flex flex-col items-center gap-6"
            style={{
              background: 'rgba(5,8,22,0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Success Icon */}
            <div
              className="p-4 rounded-full"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <Mail className="w-8 h-8 text-green-400" />
            </div>

            {/* Header */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-xl font-bold text-white">Check Your Email</h1>
              <p className="text-sm text-slate-300">We&apos;ve sent a password reset link to</p>
              <p className="text-sm font-medium" style={{ color: '#67e8f9' }}>{email}</p>
            </div>

            {/* Instructions callout */}
            <div
              className="w-full flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
            >
              <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
            </div>

            {/* Back to Login */}
            <Link href="/login" className="w-full">
              <button
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-slate-300 transition-all duration-200 hover:text-white cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm flex flex-col gap-5">
        {/* Glass card */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col gap-6"
          style={{
            background: 'rgba(5,8,22,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Reset Password</h1>
            <p className="text-sm text-slate-300">
              Enter your email and we&apos;ll send you a link to reset your password
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-200 bg-white/[0.05] border border-white/10 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/[0.08] placeholder:text-slate-600 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', border: 'none', boxShadow: '0 0 24px rgba(6,182,212,0.25)' }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-sm text-slate-500">
            Remember your password?{' '}
            <Link href="/login">
              <span className="cursor-pointer transition-colors font-medium hover:text-cyan-300" style={{ color: '#67e8f9' }}>
                Sign in
              </span>
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
