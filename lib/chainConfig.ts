/**
 * Centralized Chain Configuration
 *
 * Single source of truth for all chain-related configuration.
 * Import from this file instead of hardcoding chain IDs.
 */

// Supported chain IDs
export const CHAIN_IDS = {
  // Mainnets
  ETHEREUM: 1,
  POLYGON: 137,

  // Testnets
  SEPOLIA: 11155111,
  POLYGON_AMOY: 80002,

  // Deprecated (kept for backwards compatibility)
  POLYGON_MUMBAI: 80001,
} as const;

// Current active chain (used by the app)
export const ACTIVE_CHAIN_ID = CHAIN_IDS.SEPOLIA;

// Allowed chains for RPC proxy
export const ALLOWED_CHAIN_IDS: Set<number> = new Set([
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.POLYGON_AMOY,
  CHAIN_IDS.POLYGON,
]);

// Block explorer URLs by chain ID
export const BLOCK_EXPLORERS: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: 'https://etherscan.io',
  [CHAIN_IDS.SEPOLIA]: 'https://sepolia.etherscan.io',
  [CHAIN_IDS.POLYGON]: 'https://polygonscan.com',
  [CHAIN_IDS.POLYGON_MUMBAI]: 'https://mumbai.polygonscan.com',
  [CHAIN_IDS.POLYGON_AMOY]: 'https://amoy.polygonscan.com',
};

// RPC endpoints by chain ID (public fallbacks)
export const PUBLIC_RPC_URLS: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: 'https://eth.llamarpc.com',
  [CHAIN_IDS.SEPOLIA]: 'https://ethereum-sepolia-rpc.publicnode.com',
  [CHAIN_IDS.POLYGON]: 'https://polygon-rpc.com',
  [CHAIN_IDS.POLYGON_AMOY]: 'https://rpc-amoy.polygon.technology',
};

// Chain display names
export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: 'Ethereum Mainnet',
  [CHAIN_IDS.SEPOLIA]: 'Sepolia Testnet',
  [CHAIN_IDS.POLYGON]: 'Polygon Mainnet',
  [CHAIN_IDS.POLYGON_MUMBAI]: 'Mumbai Testnet',
  [CHAIN_IDS.POLYGON_AMOY]: 'Amoy Testnet',
};

// Native currency symbols
export const NATIVE_CURRENCIES: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: 'ETH',
  [CHAIN_IDS.SEPOLIA]: 'ETH',
  [CHAIN_IDS.POLYGON]: 'MATIC',
  [CHAIN_IDS.POLYGON_MUMBAI]: 'MATIC',
  [CHAIN_IDS.POLYGON_AMOY]: 'MATIC',
};

// Helper functions
export function getBlockExplorerUrl(chainId: number, hash: string, type: 'tx' | 'address'): string {
  const baseUrl = BLOCK_EXPLORERS[chainId] || BLOCK_EXPLORERS[CHAIN_IDS.SEPOLIA];
  return `${baseUrl}/${type}/${hash}`;
}

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

export function getNativeCurrency(chainId: number): string {
  return NATIVE_CURRENCIES[chainId] || 'ETH';
}

export function isChainSupported(chainId: number): boolean {
  return ALLOWED_CHAIN_IDS.has(chainId);
}
