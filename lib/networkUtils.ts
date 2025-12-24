// Network utilities for testnet/mainnet detection and tier conversion

// Testnet Chain IDs
export const TESTNET_CHAIN_IDS = [
  11155111, // Ethereum Sepolia
  80002,    // Polygon Amoy
  80001,    // Mumbai (deprecated)
] as const;

// Mainnet Chain IDs
export const MAINNET_CHAIN_IDS = [
  1,   // Ethereum Mainnet
  137, // Polygon Mainnet
] as const;

// Check if a chain ID is a testnet
export function isTestnet(chainId: number | undefined): boolean {
  if (!chainId) return true; // Default to testnet for safety
  return TESTNET_CHAIN_IDS.includes(chainId as any);
}

// Check if a chain ID is mainnet
export function isMainnet(chainId: number | undefined): boolean {
  if (!chainId) return false;
  return MAINNET_CHAIN_IDS.includes(chainId as any);
}

// Get network name from chain ID
export function getNetworkName(chainId: number | undefined): string {
  switch (chainId) {
    case 1:
      return 'Ethereum Mainnet';
    case 11155111:
      return 'Sepolia Testnet';
    case 137:
      return 'Polygon Mainnet';
    case 80002:
      return 'Amoy Testnet';
    case 80001:
      return 'Mumbai Testnet (Deprecated)';
    default:
      return 'Unknown Network';
  }
}

// Get network type badge color
export function getNetworkBadgeColor(chainId: number | undefined): 'green' | 'yellow' | 'red' {
  if (isMainnet(chainId)) return 'green';
  if (isTestnet(chainId)) return 'yellow';
  return 'red';
}
