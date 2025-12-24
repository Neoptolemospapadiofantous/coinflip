'use client';

import { Zap, Shield, Dices } from 'lucide-react';
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
import { formatNumber } from '@/lib/utils';

export default function Home() {
  const { data: gameStats } = useGameStats();
  const { data: tiers = [] } = useTiers();
  return (
    <Layout>
      <Section size="3" style={{ flex: 1 }}>
        <Container size="3">
          <Flex direction="column" align="center" gap="6" py="9">
            {/* Main Heading */}
            <Flex direction="column" align="center" gap="4" className="text-center animate-fade-in">
              <Badge size="2" color="cyan" variant="soft" radius="full" className="glow-cyan animate-pulse-slow">
                🎲 Provably Fair Gaming
              </Badge>
              <Heading
                size="9"
                className="text-gradient-rainbow animate-glow"
                style={{ fontSize: '4rem', lineHeight: '1.1' }}
              >
                Flip. Win. Repeat.
              </Heading>
              <Text size="5" color="gray" className="max-w-2xl">
                The first provably fair coin-flip game on Ethereum. Powered by <span className="text-cyan-400 font-semibold">Chainlink VRF</span> for
                verifiable randomness and instant payouts.
              </Text>
            </Flex>

            {/* CTA Buttons */}
            <Flex gap="3" wrap="wrap" justify="center" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link href="/play">
                <Button size="4" variant="solid" className="cursor-pointer glow-cyan hover:scale-105 transition-transform">
                  <Dices className="w-4 h-4" />
                  Start Playing
                </Button>
              </Link>
              <Link href="/queue">
                <Button size="4" variant="soft" className="cursor-pointer hover:scale-105 transition-transform">
                  View Games
                </Button>
              </Link>
              <Button size="4" variant="outline" className="cursor-pointer hover:scale-105 transition-transform">
                Learn More
              </Button>
            </Flex>

            {/* Stats */}
            <Grid columns="3" gap="4" width="100%" className="max-w-2xl mt-8">
              <StatCard
                label="Total Volume"
                value={gameStats?.total_payouts ? `${formatNumber(Number(gameStats.total_payouts) / 1e18)} ETH` : '...'}
              />
              <StatCard
                label="Games Played"
                value={gameStats?.total_games ? formatNumber(gameStats.total_games) : '...'}
              />
              <StatCard
                label="Resolved"
                value={gameStats?.resolved_count ? formatNumber(gameStats.resolved_count) : '...'}
              />
            </Grid>

            {/* Features Grid */}
            <Grid columns={{ initial: '1', md: '3' }} gap="4" width="100%" className="mt-12">
              <FeatureCard
                icon={<Dices className="w-8 h-8 text-cyan-400" />}
                title="Provably Fair"
                description="Powered by Chainlink VRF for verifiable randomness. Every flip is transparent and auditable on-chain."
              />
              <FeatureCard
                icon={<Zap className="w-8 h-8 text-yellow-400" />}
                title="Instant Payouts"
                description="Automatic payouts directly to your wallet within seconds. No waiting, no manual claims."
              />
              <FeatureCard
                icon={<Shield className="w-8 h-8 text-green-400" />}
                title="Non-Custodial"
                description="You always control your funds. Smart contracts handle everything securely on-chain."
              />
            </Grid>

            {/* Tier Selection Preview */}
            <Box className="w-full max-w-4xl mt-12">
              <Card className="card-simple card-hover">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" justify="between">
                    <Heading size="5">Choose Your Bet</Heading>
                    <Badge color="green" variant="soft">
                      Live
                    </Badge>
                  </Flex>
                  <Grid columns={{ initial: '2', md: '5' }} gap="3">
                    {tiers.map((tier, index) => (
                      <TierButton
                        key={tier.id}
                        amount={`$${tier.amountUsd}`}
                        players={tier.playersInQueue}
                        active={index === 1}
                      />
                    ))}
                  </Grid>
                </Flex>
              </Card>
            </Box>

            {/* How It Works */}
            <Box className="w-full max-w-4xl mt-12">
              <Flex direction="column" gap="6">
                <Heading size="6" align="center">
                  How It Works
                </Heading>
                <Grid columns={{ initial: '1', md: '4' }} gap="4">
                  <StepCard number="1" title="Connect Wallet" description="Link your Web3 wallet" />
                  <StepCard number="2" title="Choose Tier" description="Select bet amount" />
                  <StepCard number="3" title="Pick Side" description="Heads or tails?" />
                  <StepCard number="4" title="Win & Earn" description="Instant payout!" />
                </Grid>
              </Flex>
            </Box>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="card-simple card-hover border-cyan-500/60 animate-slide-up">
      <Flex direction="column" gap="1" p="3" align="center">
        <Text size="1" color="gray" weight="medium">
          {label}
        </Text>
        <Heading size="5" className="text-gradient-cyan-purple">
          {value}
        </Heading>
      </Flex>
    </Card>
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
    <Card className="card-interactive glow-purple">
      <Flex direction="column" gap="3" p="5">
        <Box className="p-3 rounded-lg bg-slate-800/50 border border-purple-500/30 w-fit glow-purple">
          {icon}
        </Box>
        <Heading size="4" className="text-purple-100">{title}</Heading>
        <Text size="2" color="gray">
          {description}
        </Text>
      </Flex>
    </Card>
  );
}

function TierButton({
  amount,
  players,
  active = false,
}: {
  amount: string;
  players: number;
  active?: boolean;
}) {
  return (
    <Button
      variant={active ? 'solid' : 'soft'}
      size="3"
      className={`cursor-pointer ${active ? '' : 'opacity-80 hover:opacity-100'}`}
    >
      <Flex direction="column" gap="1" align="center" py="2">
        <Text size="5" weight="bold">
          {amount}
        </Text>
        <Text size="1" color="gray">
          {players} waiting
        </Text>
      </Flex>
    </Button>
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
    <Card className="card-simple card-hover">
      <Flex direction="column" gap="2" p="4" align="center">
        <Flex
          align="center"
          justify="center"
          className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30"
        >
          <Text size="4" weight="bold" className="text-cyan-400">
            {number}
          </Text>
        </Flex>
        <Heading size="3">{title}</Heading>
        <Text size="1" color="gray" align="center">
          {description}
        </Text>
      </Flex>
    </Card>
  );
}
