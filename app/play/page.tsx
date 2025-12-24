'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Container,
  Section,
  Flex,
  Heading,
  Text,
  Button,
  Card,
  Callout,
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import { TierSelector } from '@/components/game/TierSelector';
import { CoinChoice } from '@/components/game/CoinChoice';
import { useGameStore } from '@/store/gameStore';
import { useCreateGame } from '@/hooks/useContract';
import { useTiers } from '@/hooks/useTiers';
import { Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { parseEther } from 'viem';
import { parseError } from '@/lib/errors';
import { useEffect } from 'react';

enum GameStep {
  SELECT_TIER = 'select_tier',
  CHOOSE_SIDE = 'choose_side',
  CONFIRM = 'confirm',
  CREATING = 'creating',
  WAITING = 'waiting',
}

export default function PlayPage() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState<GameStep>(GameStep.SELECT_TIER);
  const { selectedTier, coinChoice, resetGame } = useGameStore();
  const { createGame, isLoading, isSuccess, txHash, error } = useCreateGame();
  const { data: tiers } = useTiers();

  const currentTier = tiers?.find((t) => t.id === selectedTier);

  const handleCreateGame = () => {
    if (selectedTier === null || coinChoice === null || !currentTier) return;

    setStep(GameStep.CREATING);
    createGame(selectedTier, coinChoice, currentTier.amount); // Use actual wei amount
  };

  const handleReset = () => {
    resetGame();
    setStep(GameStep.SELECT_TIER);
  };

  // Update step based on selection
  const canProceedToChooseSide = selectedTier !== null;
  const canProceedToConfirm = selectedTier !== null && coinChoice !== null;

  if (!isConnected) {
    return (
      <Layout>
        <Section size="3">
          <Container size="2">
            <Flex direction="column" align="center" gap="6" py="9">
              <Card className="card-simple" size="4">
                <Flex direction="column" gap="4" p="6" align="center">
                  <Heading size="6">Connect Your Wallet</Heading>
                  <Text size="3" color="gray" align="center">
                    Please connect your Web3 wallet to start playing
                  </Text>
                  <ConnectButton />
                </Flex>
              </Card>
            </Flex>
          </Container>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section size="3">
        <Container size="3">
          <Flex direction="column" gap="6" py="6">
            {/* Header */}
            <Flex direction="column" gap="2" align="center" className="animate-fade-in">
              <Heading size="8" className="text-gradient-rainbow">Create a Game</Heading>
              <Text size="3" color="gray">
                Choose your bet amount, pick a side, and let's flip!
              </Text>
            </Flex>

            {/* Steps Indicator */}
            <Card className="card-solid border-purple-500/60 animate-slide-down">
              <Flex gap="2" p="4" justify="center" wrap="wrap">
                <StepIndicator
                  number={1}
                  label="Select Tier"
                  active={step === GameStep.SELECT_TIER}
                  completed={selectedTier !== null}
                />
                <StepIndicator
                  number={2}
                  label="Choose Side"
                  active={step === GameStep.CHOOSE_SIDE}
                  completed={coinChoice !== null}
                />
                <StepIndicator
                  number={3}
                  label="Confirm"
                  active={step === GameStep.CONFIRM}
                  completed={step === GameStep.CREATING || step === GameStep.WAITING}
                />
              </Flex>
            </Card>

            {/* Step Content */}
            <Card className="card-simple" size="4">
              <Flex direction="column" gap="6" p="6">
                {/* Step 1: Select Tier */}
                {step === GameStep.SELECT_TIER && (
                  <>
                    <TierSelector />
                    <Button
                      size="4"
                      disabled={!canProceedToChooseSide}
                      onClick={() => setStep(GameStep.CHOOSE_SIDE)}
                    >
                      Next: Choose Your Side
                    </Button>
                  </>
                )}

                {/* Step 2: Choose Side */}
                {step === GameStep.CHOOSE_SIDE && (
                  <>
                    <CoinChoice />
                    <Flex gap="3">
                      <Button size="4" variant="soft" onClick={() => setStep(GameStep.SELECT_TIER)}>
                        Back
                      </Button>
                      <Button
                        size="4"
                        className="flex-1"
                        disabled={!canProceedToConfirm}
                        onClick={() => setStep(GameStep.CONFIRM)}
                      >
                        Next: Confirm
                      </Button>
                    </Flex>
                  </>
                )}

                {/* Step 3: Confirm */}
                {step === GameStep.CONFIRM && (
                  <>
                    <Flex direction="column" gap="4">
                      <Heading size="5">Confirm Your Game</Heading>

                      <Flex direction="column" gap="3">
                        <Flex justify="between">
                          <Text color="gray">Bet Amount:</Text>
                          <Text weight="bold">${currentTier?.amountUsd}</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text color="gray">Your Choice:</Text>
                          <Text weight="bold">{coinChoice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text color="gray">Potential Win:</Text>
                          <Text weight="bold" className="text-green-400">
                            ${currentTier?.winAmountUsd}
                          </Text>
                        </Flex>
                      </Flex>

                      <Callout.Root color="blue" size="1">
                        <Callout.Icon>
                          <Info className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          After creating the game, you'll be matched with an opponent. The game will
                          resolve automatically using Chainlink VRF.
                        </Callout.Text>
                      </Callout.Root>
                    </Flex>

                    <Flex gap="3">
                      <Button size="4" variant="soft" onClick={() => setStep(GameStep.CHOOSE_SIDE)}>
                        Back
                      </Button>
                      <Button size="4" className="flex-1" onClick={handleCreateGame}>
                        Create Game
                      </Button>
                    </Flex>
                  </>
                )}

                {/* Step 4: Creating/Waiting */}
                {(step === GameStep.CREATING || step === GameStep.WAITING) && (
                  <Flex direction="column" gap="4" align="center" py="6">
                    {isLoading && (
                      <div className="animate-fade-in">
                        <Flex direction="column" gap="4" align="center">
                          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin glow-cyan" />
                          <Heading size="5" className="text-gradient-cyan-purple">Creating Game...</Heading>
                          <Text size="2" color="gray" align="center">
                            Please confirm the transaction in your wallet
                          </Text>
                        </Flex>
                      </div>
                    )}

                    {isSuccess && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="4" align="center">
                          <CheckCircle2 className="w-16 h-16 text-green-400 glow-resolved animate-pulse-slow" />
                          <Heading size="5" className="text-gradient-gold">Game Created!</Heading>
                          <Text size="2" color="gray" align="center">
                            Waiting for an opponent to join...
                          </Text>
                          {txHash && (
                            <Text size="1" className="font-mono text-gray-500">
                              TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            </Text>
                          )}
                          <Button size="3" variant="soft" onClick={handleReset} className="glow-cyan hover:scale-105 transition-transform">
                            Create Another Game
                          </Button>
                        </Flex>
                      </div>
                    )}

                    {error && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="4" align="center">
                          <AlertCircle className="w-16 h-16 text-red-400 animate-pulse" />
                          <Heading size="5" className="text-red-400">
                            {parseError(error).title}
                          </Heading>
                          <Flex direction="column" gap="2" align="center">
                            <Text size="2" color="gray" align="center">
                              {parseError(error).message}
                            </Text>
                            {parseError(error).suggestion && (
                              <Text size="1" className="text-slate-400" align="center">
                                {parseError(error).suggestion}
                              </Text>
                            )}
                          </Flex>
                          <Button size="3" onClick={handleReset} className="hover:scale-105 transition-transform">
                            Try Again
                          </Button>
                        </Flex>
                      </div>
                    )}
                  </Flex>
                )}
              </Flex>
            </Card>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <Flex align="center" gap="2" className="transition-all duration-300">
      <Flex
        align="center"
        justify="center"
        className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${
          completed
            ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 glow-resolved scale-110'
            : active
              ? 'border-cyan-500 glow-cyan scale-105 animate-pulse-slow'
              : 'border-slate-600'
        }`}
      >
        <Text
          size="2"
          weight="bold"
          className={completed || active ? 'text-white' : 'text-slate-500'}
        >
          {number}
        </Text>
      </Flex>
      <Text
        size="2"
        weight={active ? 'bold' : 'regular'}
        className={active ? 'text-cyan-400' : completed ? 'text-green-400' : 'text-gray-500'}
      >
        {label}
      </Text>
    </Flex>
  );
}
