// CoinFlip Contract ABI
// Updated to match the actual deployed contract

export const COINFLIP_ABI = [
  // =============================================================
  //                          EVENTS
  // =============================================================
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
      { name: 'totalPot', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameResolved',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'loser', type: 'address', indexed: true },
      { name: 'coinResult', type: 'bool', indexed: false },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameCancelled',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameAutoCancelled',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
      { name: 'cancelledBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VrfTimeoutClaimed',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'playerA', type: 'address', indexed: true },
      { name: 'playerB', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyRefund',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'playerA', type: 'address', indexed: true },
      { name: 'playerB', type: 'address', indexed: true },
      { name: 'totalRefund', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TierUpdated',
    inputs: [
      { name: 'tierId', type: 'uint8', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'enabled', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeesWithdrawn',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeeRecipientUpdated',
    inputs: [
      { name: 'oldRecipient', type: 'address', indexed: true },
      { name: 'newRecipient', type: 'address', indexed: true },
    ],
  },

  // =============================================================
  //                       READ FUNCTIONS
  // =============================================================

  // Get game info - returns Game struct
  // struct Game { playerA, playerB, tier, choiceA, state, createdBlock, lockedBlock, vrfRequestId, coinResult, winner }
  {
    type: 'function',
    name: 'getGame',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'playerA', type: 'address' },
          { name: 'playerB', type: 'address' },
          { name: 'tier', type: 'uint8' },
          { name: 'choiceA', type: 'bool' },
          { name: 'state', type: 'uint8' },
          { name: 'createdBlock', type: 'uint256' },
          { name: 'lockedBlock', type: 'uint256' },
          { name: 'vrfRequestId', type: 'uint256' },
          { name: 'coinResult', type: 'bool' },
          { name: 'winner', type: 'address' },
        ],
      },
    ],
  },

  // Get tier info - returns Tier struct
  {
    type: 'function',
    name: 'getTier',
    stateMutability: 'view',
    inputs: [{ name: 'tierId', type: 'uint8' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'enabled', type: 'bool' },
          { name: 'totalGames', type: 'uint256' },
          { name: 'totalVolume', type: 'uint256' },
        ],
      },
    ],
  },

  // Calculate payout for a tier
  {
    type: 'function',
    name: 'calculatePayout',
    stateMutability: 'view',
    inputs: [{ name: 'tierId', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // Check if game can be cancelled
  {
    type: 'function',
    name: 'canCancelGame',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // Check if VRF timeout can be claimed
  {
    type: 'function',
    name: 'canClaimVrfTimeout',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // Get blocks remaining until VRF timeout
  {
    type: 'function',
    name: 'getVrfTimeoutBlocksRemaining',
    stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // Constants
  {
    type: 'function',
    name: 'TIMEOUT_BLOCKS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'VRF_TIMEOUT_BLOCKS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'FEE_BASIS_POINTS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'nextGameId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'collectedFees',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'activeTierCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'feeRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Chainlink Automation - get open games count
  {
    type: 'function',
    name: 'getOpenGamesCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Chainlink Automation - get all open game IDs
  {
    type: 'function',
    name: 'getOpenGameIds',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  // Chainlink Automation - check upkeep
  {
    type: 'function',
    name: 'checkUpkeep',
    stateMutability: 'view',
    inputs: [{ name: 'checkData', type: 'bytes' }],
    outputs: [
      { name: 'upkeepNeeded', type: 'bool' },
      { name: 'performData', type: 'bytes' },
    ],
  },
  // Chainlink Automation - perform upkeep
  {
    type: 'function',
    name: 'performUpkeep',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'performData', type: 'bytes' }],
    outputs: [],
  },

  // =============================================================
  //                      WRITE FUNCTIONS
  // =============================================================

  // Create a new game
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

  // Join an existing game
  // Join a game - joiner automatically bets against creator's choice
  {
    type: 'function',
    name: 'joinGame',
    stateMutability: 'payable',
    inputs: [
      { name: 'gameId', type: 'uint256' },
    ],
    outputs: [],
  },

  // Cancel a game (after timeout)
  {
    type: 'function',
    name: 'cancelGame',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
  },

  // Claim VRF timeout refund
  {
    type: 'function',
    name: 'claimVrfTimeout',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
  },

  // =============================================================
  //                      ADMIN FUNCTIONS
  // =============================================================

  {
    type: 'function',
    name: 'setTier',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tierId', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFeeRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRecipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawFees',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'emergencyRefund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
  },
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

  // =============================================================
  //                         ERRORS
  // =============================================================
  { type: 'error', name: 'InvalidTier', inputs: [] },
  { type: 'error', name: 'TierDisabled', inputs: [] },
  { type: 'error', name: 'IncorrectBetAmount', inputs: [] },
  { type: 'error', name: 'GameDoesNotExist', inputs: [] },
  { type: 'error', name: 'InvalidGameState', inputs: [] },
  { type: 'error', name: 'CannotJoinOwnGame', inputs: [] },
  { type: 'error', name: 'NotGameCreator', inputs: [] },
  { type: 'error', name: 'TimeoutNotReached', inputs: [] },
  { type: 'error', name: 'VrfTimeoutNotReached', inputs: [] },
  { type: 'error', name: 'NotGameParticipant', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  { type: 'error', name: 'NoFeesToWithdraw', inputs: [] },
  { type: 'error', name: 'InvalidFeeRecipient', inputs: [] },
] as const;

// Game state enum matching contract
export enum GameState {
  NONE = 0,      // Game doesn't exist
  OPEN = 1,      // Waiting for opponent
  LOCKED = 2,    // Both players joined, awaiting VRF
  RESOLVED = 3,  // Game finished, winner paid
  CANCELLED = 4, // Game cancelled, refunded
}

// Tier amounts in USD (will be converted to wei)
export const TIER_AMOUNTS_USD = {
  0: 5, // $5
  1: 10, // $10
  2: 25, // $25
  3: 50, // $50
  4: 100, // $100
} as const;

// Fee percentage (3%)
export const FEE_PERCENTAGE = 3;

// Timeout blocks - matches contract constants
// Creator can cancel immediately. Chainlink Automation auto-cancels after this.
export const TIMEOUT_BLOCKS = 25; // ~5 min on Sepolia (25 blocks × 12 sec)
export const VRF_TIMEOUT_BLOCKS = 200; // ~40 min on Sepolia (for stuck VRF refunds)

// Calculate win amount after fee
export function calculateWinAmount(betAmount: number): number {
  const totalPot = betAmount * 2;
  const fee = (totalPot * FEE_PERCENTAGE) / 100;
  return totalPot - fee;
}
