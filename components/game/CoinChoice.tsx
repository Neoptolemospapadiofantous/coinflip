'use client';

import { useGameStore } from '@/store/gameStore';
import { Button, Flex, Text, Heading, Card } from '@radix-ui/themes';
import { getCoinSideEmoji } from '@/lib/utils';

export function CoinChoice() {
  const { coinChoice, setCoinChoice } = useGameStore();

  const choices = [
    { value: false, label: 'Heads', emoji: getCoinSideEmoji(false), description: 'Pick Heads' },
    { value: true, label: 'Tails', emoji: getCoinSideEmoji(true), description: 'Pick Tails' },
  ];

  return (
    <Flex direction="column" gap="4">
      <Heading size="5" className="text-gradient-cyan-purple">Choose Your Side</Heading>

      <Flex gap="4" direction={{ initial: 'column', sm: 'row' }}>
        {choices.map((choice) => {
          const isSelected = coinChoice === choice.value;

          return (
            <Button
              key={choice.label}
              variant={isSelected ? 'solid' : 'soft'}
              size="4"
              className={`cursor-pointer flex-1 transition-all duration-300 ${
                isSelected
                  ? 'neon-border-cyan scale-105 animate-pulse-slow'
                  : 'hover:scale-102 hover:border-cyan-400/30'
              }`}
              onClick={() => setCoinChoice(choice.value)}
            >
              <Flex direction="column" gap="3" align="center" py="4" className="w-full">
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
            </Button>
          );
        })}
      </Flex>

      {coinChoice !== null && (
        <Card className="card-solid border-cyan-500/60 animate-slide-up">
          <Flex direction="column" gap="2" p="3" align="center">
            <Text size="2" weight="medium" className="text-cyan-100">
              You chose: <span className="text-gradient-gold font-bold">{coinChoice ? 'Tails' : 'Heads'} {getCoinSideEmoji(coinChoice)}</span>
            </Text>
            <Text size="1" color="gray">
              If the coin lands on {coinChoice ? 'Tails' : 'Heads'}, you win!
            </Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
