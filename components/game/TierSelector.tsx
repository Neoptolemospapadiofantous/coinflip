'use client';

import { useAccount, useBalance } from 'wagmi';
import { useTiers } from '@/hooks/useTiers';
import { useGameStore } from '@/store/gameStore';
import { formatCurrency } from '@/lib/utils';
import { Button, Flex, Text, Grid, Badge, Card, Heading, Skeleton } from '@radix-ui/themes';
import { Users, Lock } from 'lucide-react';
import { parseEther } from 'viem';
import { NetworkIndicator } from '@/components/ui/NetworkIndicator';

export function TierSelector() {
  const { data: tiers, isLoading } = useTiers();
  const { selectedTier, setSelectedTier } = useGameStore();
  const { address, isConnected, chain } = useAccount();
  const { data: balance, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address,
    chainId: chain?.id, // Explicitly use the connected chain
  });

  if (isLoading) {
    return <TierSelectorSkeleton />;
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between">
        <Heading size="5">Choose Your Bet</Heading>
        {balance && (
          <Text size="2" color="gray">
            Balance: {formatCurrency(balance.value)}
          </Text>
        )}
      </Flex>

      {/* Network Indicator */}
      <NetworkIndicator />

      {/* Debug Panel - Remove after testing */}
      {tiers && tiers.length > 0 && (
        <Card className="card-simple border-yellow-400/50">
          <Flex direction="column" gap="2" p="3">
            <Text size="2" weight="bold" className="text-yellow-400">🔍 Debug Info:</Text>
            <Flex direction="column" gap="1">
              <Text size="1" className={isConnected ? 'text-green-400' : 'text-red-400'}>
                Wallet Connected: {isConnected ? 'YES ✅' : 'NO ❌'}
              </Text>
              {address && <Text size="1" color="gray">Address: {address.slice(0, 6)}...{address.slice(-4)}</Text>}
              <Text size="1" className={isBalanceLoading ? 'text-yellow-400' : 'text-gray-400'}>
                Balance Loading: {isBalanceLoading ? 'YES...' : 'NO'}
              </Text>
              {balanceError && <Text size="1" className="text-red-400">Balance Error: {balanceError.message}</Text>}
              <Text size="1" color="gray">Your Balance: {balance ? (Number(balance.value) / 1e18).toFixed(8) : '0'} ETH</Text>
              <Text size="1" color="gray">Tier 0 Amount: {(Number(BigInt(tiers[0].amount)) / 1e18).toFixed(8)} ETH (${tiers[0].amountUsd})</Text>
              <Text size="1" color="gray">Tier 0 Amount (wei): {tiers[0].amount}</Text>
              <Text size="1" className={balance && balance.value >= BigInt(tiers[0].amount) ? 'text-green-400' : 'text-red-400'}>
                Can Afford Tier 0: {balance && balance.value >= BigInt(tiers[0].amount) ? 'YES ✅' : 'NO ❌'}
              </Text>
            </Flex>
          </Flex>
        </Card>
      )}

      <Grid columns={{ initial: '2', md: '5' }} gap="3">
        {tiers?.map((tier) => {
          const tierAmount = BigInt(tier.amount); // tier.amount is already in wei
          const canAfford = balance ? balance.value >= tierAmount : false;
          const isSelected = selectedTier === tier.id;

          return (
            <Button
              key={tier.id}
              variant={isSelected ? 'solid' : 'soft'}
              size="4"
              className={`cursor-pointer transition-all ${
                !canAfford ? 'opacity-50 cursor-not-allowed' : ''
              } ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
              onClick={() => canAfford && setSelectedTier(tier.id)}
              disabled={!canAfford}
            >
              <Flex direction="column" gap="2" align="center" py="3" className="w-full">
                {/* Amount */}
                <Text size="6" weight="bold" className="text-white">
                  ${tier.amountUsd}
                </Text>

                {/* Win Amount */}
                <Text size="1" color="gray">
                  Win ${tier.winAmountUsd}
                </Text>

                {/* Players in Queue */}
                {tier.playersInQueue > 0 && (
                  <Badge color="green" variant="soft" size="1">
                    <Users className="w-3 h-3" />
                    {tier.playersInQueue} waiting
                  </Badge>
                )}

                {/* Insufficient Balance Indicator */}
                {!canAfford && (
                  <Badge color="red" variant="soft" size="1">
                    <Lock className="w-3 h-3" />
                    Low balance
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
              {tiers?.[selectedTier]?.winAmountUsd} (95% of pot, 5% fee)
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
