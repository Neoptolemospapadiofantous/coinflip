'use client';

import { useChainId } from 'wagmi';
import { Callout, Badge, Flex, Text, Link } from '@radix-ui/themes';
import { Info, AlertTriangle, ExternalLink } from 'lucide-react';
import { isTestnet, getNetworkName, getNetworkBadgeColor } from '@/lib/networkUtils';

// Faucet URLs for different testnets
const FAUCET_URLS: Record<number, { name: string; url: string }[]> = {
  11155111: [ // Sepolia
    { name: 'Alchemy', url: 'https://sepoliafaucet.com' },
    { name: 'QuickNode', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
    { name: 'Chainlink', url: 'https://faucets.chain.link/sepolia' },
  ],
  80002: [ // Polygon Amoy
    { name: 'Alchemy', url: 'https://www.alchemy.com/faucets/polygon-amoy' },
    { name: 'QuickNode', url: 'https://faucet.quicknode.com/polygon/amoy' },
  ],
};

export function NetworkIndicator() {
  const chainId = useChainId();
  const testnet = isTestnet(chainId);
  const networkName = getNetworkName(chainId);
  const badgeColor = getNetworkBadgeColor(chainId);
  const faucets = chainId ? FAUCET_URLS[chainId] : [];

  if (!chainId) return null;

  return (
    <Callout.Root color={testnet ? 'yellow' : 'green'} size="1">
      <Callout.Icon>
        {testnet ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
      </Callout.Icon>
      <Flex direction="column" gap="2">
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

        {testnet && faucets.length > 0 && (
          <Flex align="center" gap="2" wrap="wrap">
            <Text size="1" color="gray">
              Need testnet ETH?
            </Text>
            {faucets.map((faucet, i) => (
              <Link
                key={i}
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
                size="1"
                className="flex items-center gap-1"
              >
                {faucet.name} Faucet <ExternalLink className="w-3 h-3" />
              </Link>
            ))}
          </Flex>
        )}
      </Flex>
    </Callout.Root>
  );
}
