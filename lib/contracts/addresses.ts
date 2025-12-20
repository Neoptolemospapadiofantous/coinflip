// Smart Contract Addresses
export const COINFLIP_ADDRESSES = {
  // Polygon Mumbai Testnet (80001)
  80001: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,

  // Polygon Mainnet (137)
  137: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const;

// Get contract address for current chain
export function getCoinFlipAddress(chainId: number): `0x${string}` {
  return COINFLIP_ADDRESSES[chainId as keyof typeof COINFLIP_ADDRESSES] || COINFLIP_ADDRESSES[80001];
}

// Chainlink VRF Coordinator addresses
export const VRF_COORDINATOR_ADDRESSES = {
  80001: '0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed' as `0x${string}`, // Mumbai
  137: '0xAE975071Be8F8eE67addBC1A82488F1C24858067' as `0x${string}`, // Polygon
} as const;

// LINK Token addresses
export const LINK_TOKEN_ADDRESSES = {
  80001: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB' as `0x${string}`, // Mumbai
  137: '0xb0897686c545045aFc77CF20eC7A532E3120E0F1' as `0x${string}`, // Polygon
} as const;
