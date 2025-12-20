// CoinFlip Contract ABI
// This will be replaced with the actual ABI after smart contract deployment
// Based on doc/01_smart_contract_architecture.md

export const COINFLIP_ABI = [
  // Events
  {
    type: 'event',
    name: 'GameCreated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'tier', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'choice', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameJoined',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'joiner', type: 'address', indexed: true },
      { name: 'choice', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameResolved',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'result', type: 'bool', indexed: false },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameCancelled',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
    ],
  },

  // Read Functions
  {
    type: 'function',
    name: 'getGame',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'joiner', type: 'address' },
      { name: 'tier', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'creatorChoice', type: 'bool' },
      { name: 'joinerChoice', type: 'bool' },
      { name: 'result', type: 'bool' },
      { name: 'winner', type: 'address' },
      { name: 'status', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'getTierAmount',
    stateMutability: 'view',
    inputs: [{ name: 'tier', type: 'uint8' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getActiveGamesCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
  },

  // Write Functions
  {
    type: 'function',
    name: 'createGame',
    stateMutability: 'payable',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'choice', type: 'bool' },
    ],
    outputs: [{ name: 'gameId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'joinGame',
    stateMutability: 'payable',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'choice', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelGame',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
  },

  // Admin Functions
  {
    type: 'function',
    name: 'pause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unpause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

// Tier amounts in USD (will be converted to wei)
export const TIER_AMOUNTS_USD = {
  0: 5, // $5
  1: 10, // $10
  2: 25, // $25
  3: 50, // $50
  4: 100, // $100
} as const;

// Fee percentage (5%)
export const FEE_PERCENTAGE = 5;

// Calculate win amount after fee
export function calculateWinAmount(betAmount: number): number {
  const totalPot = betAmount * 2;
  const fee = (totalPot * FEE_PERCENTAGE) / 100;
  return totalPot - fee;
}
