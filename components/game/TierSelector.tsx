'use client';

import { useAccount, useBalance } from 'wagmi';
import { useTiers } from '@/hooks/useTiers';
import { useGameStore } from '@/store/gameStore';
import { formatCurrency } from '@/lib/utils';
import { Button, Flex, Text, Grid, Badge, Card, Heading, Skeleton } from '@radix-ui/themes';
import { Users, Lock } from 'lucide-react';
import { NetworkIndicator } from '@/components/ui/NetworkIndicator';

export function TierSelector() {
  const { data: tiers, isLoading } = useTiers();
  const { selectedTier, setSelectedTier } = useGameStore();
  const { address, isConnected, chain } = useAccount();
  const { data: balance, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address,
    chainId: chain?.id,
    query: {
      enabled: Boolean(address && chain?.id),
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  if (isLoading || (isConnected && isBalanceLoading && !balance)) {
    return <TierSelectorSkeleton />;
  }

  // Show error message if balance fetch failed
  if (balanceError) {
    console.error('Balance fetch error:', balanceError);
  }

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Heading size="5">Choose Your Bet</Heading>
          {isConnected && balance && (
            <Text size="2" color="gray">
              Balance: {formatCurrency(balance.value)}
            </Text>
          )}
          {isConnected && !balance && !isBalanceLoading && (
            <Text size="2" color="red">
              Balance unavailable
            </Text>
          )}
        </Flex>
        <Text size="2" color="gray">
          Select your bet amount. Higher tiers mean bigger wins! You'll be matched with another player.
        </Text>
      </Flex>

      {/* Network Indicator */}
      <NetworkIndicator />

      <Grid columns={{ initial: '2', sm: '3', md: '5' }} gap={{ initial: '2', sm: '3' }}>
        {tiers?.map((tier) => {
          const tierAmount = BigInt(tier.amount); // tier.amount is already in wei
          const canAfford = balance ? balance.value >= tierAmount : false;
          const isSelected = selectedTier === tier.id;

          return (
            <Button
              key={tier.id}
              variant={isSelected ? 'solid' : 'soft'}
              size={{ initial: '3', sm: '4' }}
              className={`cursor-pointer transition-all touch-target ${
                !canAfford ? 'opacity-50 cursor-not-allowed' : ''
              } ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
              onClick={() => canAfford && setSelectedTier(tier.id)}
              disabled={!canAfford}
            >
              <Flex direction="column" gap={{ initial: '1', sm: '2' }} align="center" py={{ initial: '2', sm: '3' }} className="w-full">
                {/* Amount */}
                <Text size={{ initial: '5', sm: '6' }} weight="bold" className="text-white">
                  ${tier.amountUsd}
                </Text>

                {/* Win Amount */}
                <Text size="1" color="gray" className="whitespace-nowrap">
                  Win ${tier.winAmountUsd}
                </Text>

                {/* Players in Queue */}
                {tier.playersInQueue > 0 && (
                  <Badge color="green" variant="soft" size="1">
                    <Users className="w-3 h-3" />
                    <span className="hidden sm:inline">{tier.playersInQueue} waiting</span>
                    <span className="sm:hidden">{tier.playersInQueue}</span>
                  </Badge>
                )}

                {/* Insufficient Balance Indicator */}
                {!canAfford && (
                  <Badge color="red" variant="soft" size="1">
                    <Lock className="w-3 h-3" />
                    <span className="hidden sm:inline">Low balance</span>
                    <span className="sm:hidden">Low</span>
                  </Badge>
                )}
              </Flex>
            </Button>
          );
        })}
      </Grid>

      {selectedTier !== null && (
        <Card className="card-simple">
          <Flex direction="column" gap="2" p="3">
            <Text size="2" weight="medium">
              Selected Tier: ${tiers?.[selectedTier]?.amountUsd}
            </Text>
            <Text size="1" color="gray">
              You'll pay ${tiers?.[selectedTier]?.amountUsd} and can win up to $
              {tiers?.[selectedTier]?.winAmountUsd} (97% of pot, 3% fee)
            </Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}

function TierSelectorSkeleton() {
  return (
    <Flex direction="column" gap="4">
      <Skeleton>
        <Heading size="5">Loading tiers...</Heading>
      </Skeleton>
      <Grid columns={{ initial: '2', md: '5' }} gap="3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i}>
            <div className="h-32 w-full" />
          </Skeleton>
        ))}
      </Grid>
    </Flex>
  );
}
