'use client';

import { Flex } from '@radix-ui/themes';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from '@/components/ui/Toaster';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" style={{ minHeight: '100vh' }} className="relative">
      {/* Ambient background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Vignette effect */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-slate-950" />
      </div>

      <Header />

      <Flex direction="column" style={{ flex: 1 }} className="relative z-0">
        {children}
      </Flex>

      <Footer />
      <Toaster />
    </Flex>
  );
}
