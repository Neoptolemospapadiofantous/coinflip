'use client';

import { useGameStore } from '@/store/gameStore';
import { Button, Flex, Text, Heading, Card, Callout } from '@radix-ui/themes';
import { getCoinSideEmoji } from '@/lib/utils';
import { Info } from 'lucide-react';

export function CoinChoice() {
  const { coinChoice, setCoinChoice } = useGameStore();

  const choices = [
    { value: false, label: 'Heads', emoji: getCoinSideEmoji(false), description: "The King's Side" },
    { value: true, label: 'Tails', emoji: getCoinSideEmoji(true), description: 'The Lucky Coin' },
  ];

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="2" align="center">
        <Heading size="5" className="text-gradient-cyan-purple">Heads or Tails? 🪙</Heading>
        <Text size="2" color="gray" align="center">
          Pick your side - 50/50 chance to win!
        </Text>
      </Flex>

      <Flex gap="4" direction={{ initial: 'column', sm: 'row' }}>
        {choices.map((choice) => {
          const isSelected = coinChoice === choice.value;

          return (
            <Card
              key={choice.label}
              className={`cursor-pointer flex-1 transition-all duration-300 ${
                isSelected
                  ? 'card-solid border-cyan-500 neon-border-cyan scale-105 animate-pulse-slow'
                  : 'card-simple hover:scale-102 hover:border-cyan-400/30'
              }`}
              onClick={() => setCoinChoice(choice.value)}
            >
              <Flex direction="column" gap="3" align="center" p="6">
                {/* Emoji with animation */}
                <Text
                  className={`text-6xl transition-transform duration-300 ${
                    isSelected ? 'animate-flip' : ''
                  }`}
                >
                  {choice.emoji}
                </Text>

                {/* Label */}
                <Text size="5" weight="bold" className={isSelected ? "text-cyan-100" : "text-white"}>
                  {choice.label}
                </Text>

                {/* Description */}
                <Text size="2" color="gray">
                  {choice.description}
                </Text>
              </Flex>
            </Card>
          );
        })}
      </Flex>

      {coinChoice !== null && (
        <Card className="card-solid border-cyan-500/60 animate-slide-up">
          <Flex direction="column" gap="2" p="4" align="center">
            <Text size="3" weight="bold" className="text-cyan-400">
              ✓ You chose: {coinChoice ? 'Tails' : 'Heads'} {getCoinSideEmoji(coinChoice)}
            </Text>
            <Text size="2" color="gray" align="center">
              Your opponent gets: {!coinChoice ? 'Tails' : 'Heads'} {getCoinSideEmoji(!coinChoice)}
            </Text>
            <Text size="2" align="center" className="text-green-400">
              If it lands {coinChoice ? 'Tails' : 'Heads'}, you win! 🎉
            </Text>
          </Flex>
        </Card>
      )}

      <Callout.Root color="blue" size="1">
        <Callout.Icon>
          <Info className="w-4 h-4" />
        </Callout.Icon>
        <Callout.Text>
          <Text size="1">
            🎲 Powered by Chainlink VRF - Provably fair and impossible to predict
          </Text>
        </Callout.Text>
      </Callout.Root>
    </Flex>
  );
}
