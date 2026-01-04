'use client';

import { Zap, Shield, Dices, Wallet, User, Cloud, Bell } from 'lucide-react';
import {
  Button,
  Flex,
  Card,
  Text,
  Heading,
  Container,
  Section,
  Box,
  Grid,
  Badge,
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { useGameStats } from '@/hooks/useGames';
import { useTiers } from '@/hooks/useTiers';
import { usePendingByTier } from '@/hooks/useRealtimeStats';
import { GlobalStatsGrid } from '@/components/stats/StatsCards';
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

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Helper to get pending count for a tier
  const getPendingCount = (tierId: number) => {
    const tierData = pendingByTier?.find((t) => t.tier === tierId);
    return tierData?.pending_count || 0;
  };

  // Show loading while checking auth to prevent flash
  if (isLoading || isAuthenticated) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Box className="animate-pulse">
          <Dices className="w-12 h-12 text-cyan-400" />
        </Box>
      </Flex>
    );
  }

  return (
    <Layout>
      <Section size="2" style={{ flex: 1 }}>
        <Container size="3">
          <Flex direction="column" align="center" gap="8" py="6">
            {/* Hero Section */}
            <Flex direction="column" align="center" gap="4" className="text-center animate-fade-in">
              <Badge size="2" color="cyan" variant="soft" radius="full" className="glow-cyan">
                Provably Fair Gaming
              </Badge>
              <Heading
                size={{ initial: '8', sm: '9' }}
                className="text-gradient-rainbow"
                style={{ lineHeight: '1.1' }}
              >
                Flip. Win. Repeat.
              </Heading>
              <Text size={{ initial: '3', sm: '4' }} color="gray" className="max-w-xl">
                Provably fair coin-flip on Ethereum. Powered by{' '}
                <span className="text-cyan-400 font-semibold">Chainlink VRF</span> for
                verifiable randomness.
              </Text>
            </Flex>

            {/* CTA Cards */}
            <Grid columns={{ initial: '1', sm: '2' }} gap="4" width="100%" className="max-w-3xl">
              {/* Decentralized Mode */}
              <Card className="card-simple hover:border-cyan-500/50 transition-colors h-full">
                <Flex direction="column" gap="3" p="4" className="h-full">
                  <Flex align="center" gap="2">
                    <Box className="p-2 rounded-lg bg-cyan-500/20">
                      <Wallet className="w-5 h-5 text-cyan-400" />
                    </Box>
                    <Badge color="cyan" variant="soft" size="1">Free</Badge>
                  </Flex>
                  <Heading size="4">Play Decentralized</Heading>
                  <Text size="2" color="gray">
                    Connect wallet and play instantly. No account needed.
                  </Text>
                  <Flex direction="column" gap="1" className="mt-1">
                    <FeatureItem text="Direct blockchain reads" />
                    <FeatureItem text="No registration required" />
                    <FeatureItem text="Full game functionality" />
                  </Flex>
                  <Box className="mt-auto pt-3">
                    {isConnected ? (
                      <Link href="/play">
                        <Button size="3" variant="solid" color="cyan" className="w-full cursor-pointer">
                          <Dices className="w-4 h-4" />
                          Start Playing
                        </Button>
                      </Link>
                    ) : (
                      <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                          <Button
                            size="3"
                            variant="solid"
                            color="cyan"
                            className="w-full cursor-pointer"
                            onClick={openConnectModal}
                          >
                            <Wallet className="w-4 h-4" />
                            Connect Wallet
                          </Button>
                        )}
                      </ConnectButton.Custom>
                    )}
                  </Box>
                </Flex>
              </Card>

              {/* Centralized Mode */}
              <Card className="card-simple hover:border-purple-500/50 transition-colors h-full">
                <Flex direction="column" gap="3" p="4" className="h-full">
                  <Flex align="center" gap="2">
                    <Box className="p-2 rounded-lg bg-purple-500/20">
                      <User className="w-5 h-5 text-purple-400" />
                    </Box>
                    <Badge color="purple" variant="soft" size="1">Enhanced</Badge>
                  </Flex>
                  <Heading size="4">Login for More</Heading>
                  <Text size="2" color="gray">
                    Unlock premium features and real-time updates.
                  </Text>
                  <Flex direction="column" gap="1" className="mt-1">
                    <FeatureItem text="Real-time game updates" icon={<Zap className="w-3 h-3" />} color="purple" />
                    <FeatureItem text="Cross-device sync" icon={<Cloud className="w-3 h-3" />} color="purple" />
                    <FeatureItem text="Activity notifications" icon={<Bell className="w-3 h-3" />} color="purple" />
                  </Flex>
                  <Box className="mt-auto pt-3">
                    {isLoggedIn ? (
                      <Link href="/play">
                        <Button size="3" variant="solid" color="purple" className="w-full cursor-pointer">
                          <Dices className="w-4 h-4" />
                          Play Premium
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/login">
                        <Button size="3" variant="solid" color="purple" className="w-full cursor-pointer">
                          <User className="w-4 h-4" />
                          Login / Register
                        </Button>
                      </Link>
                    )}
                  </Box>
                </Flex>
              </Card>
            </Grid>

            {/* Quick Actions */}
            {isConnected && (
              <Flex gap="3" align="center">
                <Link href="/play">
                  <Button size="2" variant="soft" className="cursor-pointer gap-2">
                    <Dices className="w-4 h-4" />
                    Quick Play
                  </Button>
                </Link>
                <Link href="/queue">
                  <Button size="2" variant="soft" color="gray" className="cursor-pointer">
                    View Games
                  </Button>
                </Link>
              </Flex>
            )}

            {/* Stats */}
            <Box className="w-full max-w-3xl">
              <GlobalStatsGrid
                totalGames={gameStats?.total_games ?? 0}
                activePlayers={gameStats?.total_unique_players ?? 0}
                totalVolume={gameStats?.total_volume_wei?.toString() ?? '0'}
                avgWinRate={50}
              />
            </Box>

            {/* Features */}
            <Grid columns={{ initial: '1', sm: '3' }} gap="4" width="100%" className="max-w-3xl">
              <FeatureCard
                icon={<Dices className="w-6 h-6 text-cyan-400" />}
                title="Provably Fair"
                description="Chainlink VRF ensures verifiable randomness on-chain."
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6 text-yellow-400" />}
                title="Instant Payouts"
                description="Automatic payouts directly to your wallet."
              />
              <FeatureCard
                icon={<Shield className="w-6 h-6 text-green-400" />}
                title="Non-Custodial"
                description="You always control your funds on-chain."
              />
            </Grid>

            {/* Tiers Preview */}
            <Box className="w-full max-w-3xl">
              <Card className="card-simple">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" justify="between">
                    <Heading size="4">Choose Your Bet</Heading>
                    <Badge color="green" variant="soft" size="1">
                      Live
                    </Badge>
                  </Flex>
                  <Grid columns={{ initial: '3', sm: '5' }} gap="3">
                    {tiers.map((tier) => (
                      <TierDisplay
                        key={tier.id}
                        amount={`$${tier.amountUsd}`}
                        players={getPendingCount(tier.id)}
                      />
                    ))}
                  </Grid>
                </Flex>
              </Card>
            </Box>

            {/* How It Works */}
            <Box className="w-full max-w-3xl">
              <Flex direction="column" gap="4">
                <Heading size="5" align="center">
                  How It Works
                </Heading>
                <Grid columns={{ initial: '2', sm: '4' }} gap="3">
                  <StepCard number="1" title="Connect" description="Link wallet" />
                  <StepCard number="2" title="Choose" description="Select bet" />
                  <StepCard number="3" title="Flip" description="Heads or tails" />
                  <StepCard number="4" title="Win" description="Instant payout" />
                </Grid>
              </Flex>
            </Box>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}

function FeatureItem({
  text,
  icon,
  color = 'cyan',
}: {
  text: string;
  icon?: React.ReactNode;
  color?: 'cyan' | 'purple';
}) {
  const checkColor = color === 'cyan' ? 'text-cyan-400' : 'text-purple-400';
  return (
    <Flex align="center" gap="2">
      {icon || (
        <svg className={`w-4 h-4 ${checkColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      <Text size="2" color="gray">{text}</Text>
    </Flex>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="card-simple card-hover">
      <Flex direction="column" gap="2" p="4">
        <Box className="p-2 rounded-lg bg-slate-800/50 w-fit">
          {icon}
        </Box>
        <Heading size="3">{title}</Heading>
        <Text size="1" color="gray">
          {description}
        </Text>
      </Flex>
    </Card>
  );
}

function TierDisplay({
  amount,
  players,
}: {
  amount: string;
  players: number;
}) {
  return (
    <Box className="bg-slate-800/50 border border-slate-700/60 rounded-lg py-4 px-3">
      <Flex direction="column" gap="1" align="center">
        <Text size="4" weight="bold" className="text-cyan-400">
          {amount}
        </Text>
        <Text size="1" color="gray">
          {players} waiting
        </Text>
      </Flex>
    </Box>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="card-simple">
      <Flex direction="column" gap="1" p="3" align="center">
        <Flex
          align="center"
          justify="center"
          className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30"
        >
          <Text size="3" weight="bold" className="text-cyan-400">
            {number}
          </Text>
        </Flex>
        <Heading size="2">{title}</Heading>
        <Text size="1" color="gray" align="center">
          {description}
        </Text>
      </Flex>
    </Card>
  );
}
