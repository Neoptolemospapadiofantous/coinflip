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

export default function Home() {
  return (
    <Layout>
      <Section size="3" style={{ flex: 1 }}>
        <Container size="3">
          <Flex direction="column" align="center" gap="6" py="9">
            {/* Main Heading */}
            <Flex direction="column" align="center" gap="4" className="text-center">
              <Badge size="2" color="cyan" variant="soft" radius="full">
                🎲 Provably Fair Gaming
              </Badge>
              <Heading
                size="9"
                className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
              >
                Flip. Win. Repeat.
              </Heading>
              <Text size="5" color="gray" className="max-w-2xl">
                The first provably fair coin-flip game on Polygon. Powered by Chainlink VRF for
                verifiable randomness and instant payouts.
              </Text>
            </Flex>

            {/* CTA Buttons */}
            <Flex gap="3" wrap="wrap" justify="center">
              <Button size="4" variant="solid" className="cursor-pointer">
                <Dices className="w-4 h-4" />
                Start Playing
              </Button>
              <Button size="4" variant="soft" className="cursor-pointer">
                View Games
              </Button>
              <Button size="4" variant="outline" className="cursor-pointer">
                Learn More
              </Button>
            </Flex>

            {/* Stats */}
            <Grid columns="3" gap="4" width="100%" className="max-w-2xl mt-8">
              <StatCard label="Total Volume" value="$1.2M" />
              <StatCard label="Games Played" value="15,234" />
              <StatCard label="Active Players" value="892" />
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
              <Card className="glass glass-hover">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" justify="between">
                    <Heading size="5">Choose Your Bet</Heading>
                    <Badge color="green" variant="soft">
                      Live
                    </Badge>
                  </Flex>
                  <Grid columns={{ initial: '2', md: '5' }} gap="3">
                    <TierButton amount="$5" players={12} />
                    <TierButton amount="$10" players={8} active />
                    <TierButton amount="$25" players={5} />
                    <TierButton amount="$50" players={3} />
                    <TierButton amount="$100" players={1} />
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
    <Card className="glass">
      <Flex direction="column" gap="1" p="3" align="center">
        <Text size="1" color="gray" weight="medium">
          {label}
        </Text>
        <Heading size="5" className="text-cyan-400">
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
    <Card className="glass glass-hover">
      <Flex direction="column" gap="3" p="5">
        <Box className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 w-fit">
          {icon}
        </Box>
        <Heading size="4">{title}</Heading>
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
    <Card className="glass glass-hover">
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
