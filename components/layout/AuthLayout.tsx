'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Toaster } from '@/components/ui/Toaster';
import { LogoIcon } from '@/components/ui/LogoIcon';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const pathNames: Record<string, string> = {
  '/login': 'Sign In',
  '/register': 'Create Account',
  '/forgot-password': 'Reset Password',
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const currentPageName = pathNames[pathname] || 'Auth';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(168,85,247,0.07) 0%, transparent 60%), #020617' }}>
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full animate-float"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full animate-float"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '-3s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: 'linear-gradient(rgba(6,182,212,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.6) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-6 h-[60px] flex-shrink-0"
        style={{ background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/" className="no-underline flex items-center gap-2 group">
          <div className="transition-all duration-300 group-hover:scale-110">
            <LogoIcon size={24} />
          </div>
          <span
            className="text-base font-bold hidden sm:block"
            style={{ background: 'linear-gradient(to right, #67e8f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            CoinFlip
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link href="/" className="no-underline flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-700" />
          <span className="text-slate-300 font-medium">{currentPageName}</span>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 py-12">
        {children}
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-6 text-center">
        <p className="text-xs text-slate-700">&copy; {new Date().getFullYear()} CoinFlip. All rights reserved.</p>
      </div>

      <Toaster />
    </div>
  );
}
