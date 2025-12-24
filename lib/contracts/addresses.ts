// Smart Contract Addresses
export const COINFLIP_ADDRESSES = {
  // Ethereum Sepolia Testnet (11155111) - Recommended for testing
  11155111: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,

  // Polygon Amoy Testnet (80002) - Replaced Mumbai in 2024
  80002: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,

  // Polygon Mumbai Testnet (80001) - DEPRECATED: Shutdown in April 2024
  80001: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,

  // Polygon Mainnet (137)
  137: (process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const;

// Get contract address for current chain
export function getCoinFlipAddress(chainId: number): `0x${string}` {
  return COINFLIP_ADDRESSES[chainId as keyof typeof COINFLIP_ADDRESSES] || COINFLIP_ADDRESSES[11155111];
}

// Chainlink VRF Coordinator addresses (V2.5)
export const VRF_COORDINATOR_ADDRESSES = {
  11155111: '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B' as `0x${string}`, // Sepolia (V2.5)
  80002: '0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2' as `0x${string}`, // Amoy (V2.5)
  80001: '0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed' as `0x${string}`, // Mumbai (DEPRECATED)
  137: '0xec0Ed46f36576541C75739E915ADbCb3DE24bD77' as `0x${string}`, // Polygon (V2.5)
} as const;

// LINK Token addresses
export const LINK_TOKEN_ADDRESSES = {
  11155111: '0x779877A7B0D9E8603169DdbD7836e478b4624789' as `0x${string}`, // Sepolia
  80002: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904' as `0x${string}`, // Amoy
  80001: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB' as `0x${string}`, // Mumbai (DEPRECATED)
  137: '0xb0897686c545045aFc77CF20eC7A532E3120E0F1' as `0x${string}`, // Polygon
} as const;
