'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Mail, Lock, Chrome, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithMicrosoft, signInWithEmail, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace('/dashboard');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#020617' }}>
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google');
    setError(null);
    const result = await signInWithGoogle();
    if (!result.success) { setError(result.error || 'Failed to sign in with Google'); setLoadingProvider(null); }
  };

  const handleMicrosoftSignIn = async () => {
    setLoadingProvider('microsoft');
    setError(null);
    const result = await signInWithMicrosoft();
    if (!result.success) { setError(result.error || 'Failed to sign in with Microsoft'); setLoadingProvider(null); }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email || !password) { setError('Please enter email and password'); setIsLoading(false); return; }

    const result = await signInWithEmail(email, password);
    if (result.success) {
      showToast.success('Welcome back!');
      router.push('/');
    } else {
      setError(result.needsEmailVerification
        ? 'Please verify your email before signing in. Check your inbox.'
        : result.error || 'Failed to sign in');
    }
    setIsLoading(false);
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-sm flex flex-col gap-5">
        {/* Glass card */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col gap-6"
          style={{
            background: 'rgba(5,8,22,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
            <p className="text-sm text-slate-400">Sign in to access premium features</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* OAuth */}
          <div className="flex flex-col gap-3">
            <OAuthButton onClick={handleGoogleSignIn} disabled={!!loadingProvider}
              loading={loadingProvider === 'google'} icon={<Chrome className="w-4 h-4" />} label="Continue with Google" />
            <OAuthButton onClick={handleMicrosoftSignIn} disabled={!!loadingProvider}
              loading={loadingProvider === 'microsoft'} icon={<MicrosoftIcon className="w-4 h-4" />} label="Continue with Microsoft" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs text-slate-500 whitespace-nowrap">or continue with email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
            <InputField label="Email" type="email" placeholder="you@example.com"
              value={email} onChange={setEmail} disabled={isLoading} icon={<Mail className="w-4 h-4" />} />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password">
                  <span className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Forgot password?</span>
                </Link>
              </div>
              <InputField type="password" placeholder="Enter your password"
                value={password} onChange={setPassword} disabled={isLoading} icon={<Lock className="w-4 h-4" />} />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 mt-1 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: '0 0 24px rgba(6,182,212,0.25)' }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register">
              <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors font-medium">Sign up</span>
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-700">
          By signing in, you agree to our Terms of Service and Privacy Policy. Your wallet can be linked after login.
        </p>
      </div>
    </AuthLayout>
  );
}

function InputField({
  label, type, placeholder, value, onChange, disabled, icon,
}: {
  label?: string; type: string; placeholder: string; value: string;
  onChange: (v: string) => void; disabled: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">{icon}</div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none bg-white/[0.04] border border-white/10 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/[0.08] disabled:opacity-60 transition-all duration-200"
        />
      </div>
    </div>
  );
}

function OAuthButton({
  onClick, disabled, loading, icon, label,
}: {
  onClick: () => void; disabled: boolean; loading: boolean; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/[0.18] hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
