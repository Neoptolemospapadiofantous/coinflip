'use client';

import { useChainId } from 'wagmi';
import { Info, AlertTriangle, ExternalLink } from 'lucide-react';
import { isTestnet, getNetworkName, getNetworkBadgeColor } from '@/lib/networkUtils';
import Link from 'next/link';

const FAUCET_URLS: Record<number, { name: string; url: string }[]> = {
  11155111: [
    { name: 'Alchemy', url: 'https://sepoliafaucet.com' },
    { name: 'QuickNode', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
    { name: 'Chainlink', url: 'https://faucets.chain.link/sepolia' },
  ],
  80002: [
    { name: 'Alchemy', url: 'https://www.alchemy.com/faucets/polygon-amoy' },
    { name: 'QuickNode', url: 'https://faucet.quicknode.com/polygon/amoy' },
  ],
};

const BADGE_COLORS: Record<string, string> = {
  cyan: '#67e8f9', green: '#86efac', yellow: '#fbbf24', red: '#fca5a5', blue: '#93c5fd', purple: '#c4b5fd',
};

export function NetworkIndicator() {
  const chainId = useChainId();
  const testnet = isTestnet(chainId);
  const networkName = getNetworkName(chainId);
  const badgeColor = getNetworkBadgeColor(chainId);
  const faucets = chainId ? FAUCET_URLS[chainId] : [];

  if (!chainId) return null;

  const color = BADGE_COLORS[badgeColor] ?? '#fbbf24';
  const isWarn = testnet;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={
        isWarn
          ? { background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)' }
          : { background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }
      }
    >
      {isWarn
        ? <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        : <Info className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
      }
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-slate-300">
          {testnet ? "You're on " : 'Connected to '}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold mx-0.5" style={{ background: `${color}20`, color }}>
            {networkName}
          </span>
          {testnet ? ' — Using testnet tier amounts (100x smaller for easy testing)' : ' — Using production tier amounts'}
        </p>

        {testnet && faucets.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">Need testnet ETH?</span>
            {faucets.map((faucet, i) => (
              <Link
                key={i}
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors no-underline"
              >
                {faucet.name} Faucet <ExternalLink className="w-3 h-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
