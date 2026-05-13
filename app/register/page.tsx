'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Mail, Lock, Chrome, Loader2, AlertCircle, CheckCircle, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithMicrosoft, signUpWithEmail, resendVerification, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);

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

  const handleGoogleSignUp = async () => {
    setLoadingProvider('google');
    setError(null);
    const result = await signInWithGoogle();
    if (!result.success) { setError(result.error || 'Failed to sign up with Google'); setLoadingProvider(null); }
  };

  const handleMicrosoftSignUp = async () => {
    setLoadingProvider('microsoft');
    setError(null);
    const result = await signInWithMicrosoft();
    if (!result.success) { setError(result.error || 'Failed to sign up with Microsoft'); setLoadingProvider(null); }
  };

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pass)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pass)) return 'Password must contain at least one number';
    return null;
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email || !password || !confirmPassword) { setError('Please fill in all fields'); setIsLoading(false); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError('Please enter a valid email address'); setIsLoading(false); return; }

    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); setIsLoading(false); return; }

    if (password !== confirmPassword) { setError('Passwords do not match'); setIsLoading(false); return; }

    const result = await signUpWithEmail(email, password);
    if (result.success) { setEmailSent(true); } else { setError(result.error || 'Failed to create account'); }
    setIsLoading(false);
  };

  const handleResendEmail = async () => {
    setResending(true);
    const result = await resendVerification(email);
    if (!result.success) setError(result.error || 'Failed to resend verification email');
    else setError(null);
    setResending(false);
  };

  if (emailSent) {
    return (
      <AuthLayout>
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6"
          style={{
            background: 'rgba(5,8,22,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="p-4 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Mail className="w-8 h-8 text-green-400" />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-sm text-slate-400 mb-1">We've sent a verification link to</p>
            <p className="text-sm font-semibold text-cyan-400">{email}</p>
          </div>

          <div className="w-full flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">Click the link in the email to verify your account and complete registration.</p>
          </div>

          {error && (
            <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <button
            onClick={handleResendEmail}
            disabled={resending}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-200 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 cursor-pointer"
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Resend verification email
          </button>

          <Link href="/login">
            <span className="text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Back to login</span>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div
          className="w-full rounded-2xl p-8 flex flex-col gap-6"
          style={{
            background: 'rgba(5,8,22,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Create Account</h1>
            <p className="text-sm text-slate-400">Sign up to unlock premium features</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <OAuthButton onClick={handleGoogleSignUp} disabled={!!loadingProvider}
              loading={loadingProvider === 'google'} icon={<Chrome className="w-4 h-4" />} label="Continue with Google" />
            <OAuthButton onClick={handleMicrosoftSignUp} disabled={!!loadingProvider}
              loading={loadingProvider === 'microsoft'} icon={<MicrosoftIcon className="w-4 h-4" />} label="Continue with Microsoft" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs text-slate-500 whitespace-nowrap">or register with email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
            <InputField label="Email" type="email" placeholder="you@example.com"
              value={email} onChange={setEmail} disabled={isLoading} icon={<Mail className="w-4 h-4" />} />
            <div className="flex flex-col gap-1">
              <InputField label="Password" type="password" placeholder="At least 8 characters"
                value={password} onChange={setPassword} disabled={isLoading} icon={<Lock className="w-4 h-4" />} />
              <p className="text-xs text-slate-600 mt-1">Must contain uppercase, lowercase, and number</p>
            </div>
            <InputField label="Confirm Password" type="password" placeholder="Confirm your password"
              value={confirmPassword} onChange={setConfirmPassword} disabled={isLoading} icon={<Lock className="w-4 h-4" />} />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 mt-1 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: '0 0 24px rgba(6,182,212,0.25)' }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><User className="w-4 h-4" /> Create Account</>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login">
              <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors font-medium">Sign in</span>
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-700">
          By creating an account, you agree to our Terms of Service and Privacy Policy. Your wallet can be linked after registration.
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
