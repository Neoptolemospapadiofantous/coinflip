'use client';

import { Zap, Shield, Dices, Wallet, User, Cloud, Bell, ArrowRight, TrendingUp, Users } from 'lucide-react';
import { LogoIcon } from '@/components/ui/LogoIcon';
import { Button, Flex, Card, Text, Heading, Container, Section, Box, Grid, Badge } from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { useGameStats } from '@/hooks/useGames';
import { useTiers } from '@/hooks/useTiers';
import { usePendingByTier } from '@/hooks/useRealtimeStats';
import { useIsLoggedIn } from '@/lib/data';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { data: gameStats } = useGameStats();
  const { data: tiers = [] } = useTiers();
  const { data: pendingByTier } = usePendingByTier();
  const isLoggedIn = useIsLoggedIn();
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  const getPendingCount = (tierId: number) =>
    pendingByTier?.find(t => t.tier === tierId)?.pending_count ?? 0;

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LogoIcon size={48} className="animate-spin-slow" />
      </div>
    );
  }

  const totalGames = gameStats?.total_games ?? 0;
  const totalPlayers = gameStats?.total_unique_players ?? 0;

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 animate-float"
            style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15 animate-float"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)', filter: 'blur(60px)', animationDelay: '3s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <Container size="3">
          <div className="relative flex flex-col items-center text-center gap-8 py-20 sm:py-28">
            {/* Badge */}
            <div className="animate-fade-in">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-cyan-300"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', boxShadow: '0 0 20px rgba(6,182,212,0.15)' }}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Powered by Chainlink VRF · Provably Fair
              </span>
            </div>

            {/* Headline */}
            <div className="animate-slide-up stagger-1">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
                <span className="text-white">Flip.</span>{' '}
                <span style={{ background: 'linear-gradient(135deg,#22d3ee,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Win.</span>{' '}
                <span className="text-white">Repeat.</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed animate-slide-up stagger-2">
              Non-custodial peer-to-peer coin flip on Ethereum. Your funds never leave the blockchain —
              randomness is verifiable by anyone, always.
            </p>

            {/* Live stats pills */}
            {totalGames > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3 animate-slide-up stagger-3">
                <StatPill icon={<Dices className="w-3.5 h-3.5" />} label={`${totalGames.toLocaleString()} games played`} />
                <StatPill icon={<Users className="w-3.5 h-3.5" />} label={`${totalPlayers.toLocaleString()} players`} />
                <StatPill icon={<TrendingUp className="w-3.5 h-3.5" />} label="97% payout ratio" color="green" />
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm animate-slide-up stagger-4">
              {isConnected ? (
                <Link href="/play" className="flex-1 no-underline">
                  <button
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] cursor-pointer"
                    style={{ background: 'linear-gradient(135deg,#22d3ee,#06b6d4)' }}
                  >
                    <Dices className="w-5 h-5" />
                    Start Playing
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold text-black transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] cursor-pointer"
                      style={{ background: 'linear-gradient(135deg,#22d3ee,#06b6d4)' }}
                    >
                      <Wallet className="w-5 h-5" />
                      Connect Wallet
                    </button>
                  )}
                </ConnectButton.Custom>
              )}
              <Link href="/login" className="no-underline">
                <button
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold text-slate-200 transition-all duration-200 hover:bg-white/[0.08] cursor-pointer"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Mode Cards ── */}
      <section className="py-12">
        <Container size="3">
          <Grid columns={{ initial: '1', sm: '2' }} gap="4" className="max-w-2xl mx-auto">
            <ModeCard
              icon={<Wallet className="w-5 h-5 text-cyan-400" />}
              iconBg="rgba(6,182,212,0.12)"
              accent="cyan"
              label="Free"
              title="Play Decentralized"
              description="Connect wallet and play instantly. No account, no registration."
              features={['Direct blockchain reads', 'No registration required', 'Full game functionality']}
              cta={isConnected
                ? <Link href="/play" className="no-underline w-full"><CyanButton>Start Playing</CyanButton></Link>
                : <ConnectButton.Custom>{({ openConnectModal }) => <CyanButton onClick={openConnectModal}>Connect Wallet</CyanButton>}</ConnectButton.Custom>
              }
            />
            <ModeCard
              icon={<User className="w-5 h-5 text-purple-400" />}
              iconBg="rgba(168,85,247,0.12)"
              accent="purple"
              label="Enhanced"
              title="Login for More"
              description="Unlock real-time updates, cross-device sync, and notifications."
              features={['Real-time game updates', 'Cross-device sync', 'Activity notifications']}
              featureIcons={[<Zap className="w-3.5 h-3.5" key="z"/>, <Cloud className="w-3.5 h-3.5" key="c"/>, <Bell className="w-3.5 h-3.5" key="b"/>]}
              cta={
                <Link href={isLoggedIn ? '/play' : '/login'} className="no-underline w-full">
                  <PurpleButton>{isLoggedIn ? 'Play Premium' : 'Login / Register'}</PurpleButton>
                </Link>
              }
            />
          </Grid>
        </Container>
      </section>

      {/* ── Tier Preview ── */}
      {tiers.length > 0 && (
        <section className="py-8">
          <Container size="3">
            <div
              className="max-w-2xl mx-auto rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">Live Bet Pools</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-green-400"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {tiers.map(tier => {
                  const count = getPendingCount(tier.id);
                  return (
                    <Link key={tier.id} href="/play" className="no-underline">
                      <div
                        className="group flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.04] hover:-translate-y-0.5"
                        style={{
                          background: count > 0 ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.04)',
                          border: count > 0 ? '1px solid rgba(6,182,212,0.25)' : '1px solid rgba(255,255,255,0.07)',
                          boxShadow: count > 0 ? '0 0 16px rgba(6,182,212,0.1)' : undefined,
                        }}
                      >
                        <span className="text-xl font-bold text-cyan-400">${tier.amountUsd}</span>
                        <span className="text-[11px] text-slate-500">
                          {count > 0 ? <span className="text-green-400 font-medium">{count} waiting</span> : 'Open'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* ── How It Works ── */}
      <section className="py-12">
        <Container size="3">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-white mb-8">How It Works</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { n: '1', title: 'Connect',  desc: 'Link your wallet',      color: '#22d3ee' },
                { n: '2', title: 'Choose',   desc: 'Pick a bet amount',     color: '#a78bfa' },
                { n: '3', title: 'Flip',     desc: 'Heads or tails',        color: '#34d399' },
                { n: '4', title: 'Win',      desc: 'Instant payout',        color: '#fbbf24' },
              ].map((step, i) => (
                <div key={i} className={`flex flex-col items-center gap-2 p-4 rounded-xl text-center animate-fade-in stagger-${i+1}`}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold mb-1"
                    style={{ background: `${step.color}20`, border: `1px solid ${step.color}40`, color: step.color }}>
                    {step.n}
                  </div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Feature Trio ── */}
      <section className="py-8 pb-20">
        <Container size="3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <FeatureCard icon={<Dices className="w-6 h-6 text-cyan-400" />} iconBg="rgba(6,182,212,0.1)"
              title="Provably Fair" description="Chainlink VRF delivers tamper-proof randomness verifiable on-chain." />
            <FeatureCard icon={<Zap className="w-6 h-6 text-yellow-400" />} iconBg="rgba(250,204,21,0.1)"
              title="Instant Payouts" description="Smart contract auto-transfers winnings directly to your wallet." />
            <FeatureCard icon={<Shield className="w-6 h-6 text-green-400" />} iconBg="rgba(34,197,94,0.1)"
              title="Non-Custodial" description="Funds stay in the contract — only you can claim your winnings." />
          </div>
        </Container>
      </section>
    </Layout>
  );
}

/* ─── Sub-components ─── */

function StatPill({ icon, label, color = 'cyan' }: { icon: React.ReactNode; label: string; color?: 'cyan' | 'green' }) {
  const c = color === 'green' ? { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#86efac' } : { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)', text: '#67e8f9' };
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {icon} {label}
    </span>
  );
}

function ModeCard({ icon, iconBg, accent, label, title, description, features, featureIcons, cta }: {
  icon: React.ReactNode; iconBg: string; accent: 'cyan' | 'purple';
  label: string; title: string; description: string;
  features: string[]; featureIcons?: React.ReactNode[]; cta: React.ReactNode;
}) {
  const colors = {
    cyan:   { border: 'rgba(6,182,212,0.18)',   hoverBorder: 'rgba(6,182,212,0.35)',   check: '#22d3ee' },
    purple: { border: 'rgba(168,85,247,0.18)', hoverBorder: 'rgba(168,85,247,0.35)', check: '#c084fc' },
  }[accent];

  return (
    <div className="group flex flex-col gap-4 p-5 rounded-2xl h-full transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl" style={{ background: iconBg }}>{icon}</div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: iconBg, color: colors.check, border: `1px solid ${colors.hoverBorder}` }}>{label}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
            {featureIcons?.[i]
              ? <span style={{ color: colors.check }}>{featureIcons[i]}</span>
              : <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke={colors.check} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">{cta}</div>
    </div>
  );
}

function CyanButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 hover:scale-[1.02] cursor-pointer"
      style={{ background: 'linear-gradient(135deg,#22d3ee,#06b6d4)' }}>
      {children}
    </button>
  );
}

function PurpleButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] cursor-pointer"
      style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)' }}>
      {children}
    </button>
  );
}

function FeatureCard({ icon, iconBg, title, description }: { icon: React.ReactNode; iconBg: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="p-2.5 rounded-xl w-fit" style={{ background: iconBg }}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
