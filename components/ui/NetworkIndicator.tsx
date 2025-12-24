'use client';

import { useChainId } from 'wagmi';
import { Callout, Badge, Flex, Text } from '@radix-ui/themes';
import { Info, AlertTriangle } from 'lucide-react';
import { isTestnet, getNetworkName, getNetworkBadgeColor } from '@/lib/networkUtils';

export function NetworkIndicator() {
  const chainId = useChainId();
  const testnet = isTestnet(chainId);
  const networkName = getNetworkName(chainId);
  const badgeColor = getNetworkBadgeColor(chainId);

  if (!chainId) return null;

  return (
    <Callout.Root color={testnet ? 'yellow' : 'green'} size="1">
      <Callout.Icon>
        {testnet ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
      </Callout.Icon>
      <Flex align="center" gap="2" wrap="wrap">
        <Text size="2">
          {testnet ? (
            <>
              You're on <Badge color={badgeColor}>{networkName}</Badge> - Using testnet tier amounts (100x smaller for easy testing)
            </>
          ) : (
            <>
              Connected to <Badge color={badgeColor}>{networkName}</Badge> - Using production tier amounts
            </>
          )}
        </Text>
      </Flex>
    </Callout.Root>
  );
}
