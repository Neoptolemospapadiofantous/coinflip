'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins } from 'lucide-react';
import { Button, Flex, Card, Text, Heading } from '@radix-ui/themes';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">CoinFlip</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8 max-w-2xl mx-auto px-4">
          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-6xl font-bold text-gray-900">
              Flip. Win. Repeat.
            </h2>
            <p className="text-xl text-gray-600">
              Provably fair coin-flip gambling on Polygon with instant payouts
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <FeatureCard
              icon="🎲"
              title="Provably Fair"
              description="Powered by Chainlink VRF for verifiable randomness"
            />
            <FeatureCard
              icon="⚡"
              title="Instant Payouts"
              description="Automatic payouts directly to your wallet"
            />
            <FeatureCard
              icon="🔒"
              title="Non-Custodial"
              description="You always control your funds"
            />
          </div>

          {/* CTA */}
          <div className="pt-8">
            <p className="text-sm text-gray-500 mb-4">
              Connect your wallet to get started
            </p>
            <ConnectButton />
          </div>

          {/* Radix UI Demo */}
          <Card className="mt-8">
            <Flex direction="column" gap="3" align="center">
              <Heading size="4">Radix UI is Ready!</Heading>
              <Text color="gray">Beautiful, accessible components for your Web3 app</Text>
              <Flex gap="3">
                <Button size="3" variant="solid">
                  Hey 👋
                </Button>
                <Button size="3" variant="soft">
                  Soft Button
                </Button>
                <Button size="3" variant="outline">
                  Outline
                </Button>
              </Flex>
            </Flex>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 backdrop-blur-sm py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>Built with Next.js, wagmi, and Chainlink VRF</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
