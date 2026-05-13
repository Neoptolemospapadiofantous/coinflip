/**
 * Blockchain Data Source
 *
 * Reads game data directly from the blockchain via RPC.
 * Used in decentralized mode when user is not logged in.
 *
 * Features:
 * - Direct contract reads (no centralized database)
 * - Event log parsing for game history
 * - Real-time WebSocket event watching (with polling fallback)
 * - Works offline from Supabase
 *
 * Limitations:
 * - Slower than indexed database
 * - No complex queries (sorting, filtering limited)
 */

import { createPublicClient, http, webSocket, parseAbiItem, type PublicClient, type WatchContractEventReturnType } from 'viem';
import { sepolia } from 'viem/chains';
import { Game } from '@/types/game';
import {
  GameDataSource,
  Tier,
  PlayerStats,
  GameStats,
} from './types';
import { COINFLIP_ABI } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';
import { devLog } from '@/lib/utils';

// ============================================
// CONFIGURATION
// ============================================

// Use the same RPC proxy as wagmi to avoid CORS issues
// Falls back to public RPC if running server-side
const getRpcUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser: use proxy endpoint
    return '/api/rpc';
  }
  // Server-side: use direct RPC
  return process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org';
};

// WebSocket URL for real-time events (optional but recommended)
// Note: NEXT_PUBLIC_* env vars are inlined at build time
const WSS_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_SEPOLIA_WSS_URL || null)
  : null;

const getWssUrl = (): string | null => WSS_URL;

const CONTRACT_ADDRESS = getCoinFlipAddress(11155111); // Sepolia
const POLLING_INTERVAL = 12000; // 12 seconds - one Sepolia block time; no need to poll faster
const MAX_BLOCK_RANGE = 2000; // Max blocks to scan per query
const FINALITY_LAG = 2n; // Blocks behind head to query — avoids "beyond current head" errors from load-balanced RPC nodes

// ============================================
// RPC CONCURRENCY LIMITER
// Prevents burst-firing too many parallel requests and hitting the rate limit.
// ============================================

const MAX_CONCURRENT_RPC = 4;
let _activeRpc = 0;
const _rpcQueue: Array<() => void> = [];

async function withRpcLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (_activeRpc >= MAX_CONCURRENT_RPC) {
    await new Promise<void>(resolve => _rpcQueue.push(resolve));
  }
  _activeRpc++;
  try {
    return await fn();
  } finally {
    _activeRpc--;
    if (_rpcQueue.length > 0) _rpcQueue.shift()!();
  }
}
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ETH_PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ACTIVE_GAME_REFRESH_INTERVAL = 3000; // 3 seconds - fallback for individual game tracking

// Log contract address on load (for debugging)
if (typeof window !== 'undefined') {
  devLog.log('[BlockchainDS] Contract address:', CONTRACT_ADDRESS);
  devLog.log('[BlockchainDS] WebSocket URL:', getWssUrl() ? 'configured' : 'not configured (using polling)');
}

// ============================================
// CLIENT SETUP
// ============================================

let publicClient: PublicClient | null = null;
let wsClient: PublicClient | null = null;
let wsAvailable = false;

function getClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(getRpcUrl(), {
        timeout: 30000, // 30s timeout
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
  }
  return publicClient;
}

// Get WebSocket client for real-time event watching
function getWsClient(): PublicClient | null {
  const wssUrl = getWssUrl();
  if (!wssUrl) return null;

  if (!wsClient) {
    try {
      wsClient = createPublicClient({
        chain: sepolia,
        transport: webSocket(wssUrl, {
          reconnect: {
            attempts: 5,
            delay: 1000,
          },
          keepAlive: {
            interval: 30000,
          },
        }),
      });
      wsAvailable = true;
      devLog.log('[BlockchainDS] WebSocket client created');
    } catch (error) {
      devLog.warn('[BlockchainDS] Failed to create WebSocket client:', error);
      wsAvailable = false;
      return null;
    }
  }
  return wsClient;
}

// Check if WebSocket is available
function isWsAvailable(): boolean {
  return wsAvailable && !!getWsClient();
}

// Reset clients (useful if connection fails and needs reconnection)
export function resetBlockchainClient(): void {
  publicClient = null;
  wsClient = null;
  wsAvailable = false;
}

// ============================================
// CONTRACT TYPES (needed for cache)
// ============================================

// Tier struct from contract (defined early for cache usage)
interface ContractTier {
  amount: bigint;
  enabled: boolean;
  totalGames: bigint;
  totalVolume: bigint;
}

// ============================================
// TIER CACHE (avoid redundant RPC calls)
// ============================================

interface TierCacheEntry {
  tier: ContractTier;
  expiresAt: number;
}

const tierCache: Map<number, TierCacheEntry> = new Map();

async function getTierCached(tierId: number): Promise<ContractTier | null> {
  const now = Date.now();
  const cached = tierCache.get(tierId);

  if (cached && now < cached.expiresAt) {
    return cached.tier;
  }

  const tier = await getTierFromContract(tierId);
  if (tier) {
    tierCache.set(tierId, {
      tier,
      expiresAt: now + TIER_CACHE_TTL,
    });
  }

  return tier;
}

// ============================================
// ETH PRICE CACHE
// ============================================

let cachedEthPrice = 3000;
let ethPriceCacheExpiry = 0;

async function fetchEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return cachedEthPrice;
    const data = await response.json();
    return data?.ethereum?.usd || cachedEthPrice;
  } catch {
    devLog.warn('[BlockchainDS] Failed to fetch ETH price, using cached value');
    return cachedEthPrice;
  }
}

async function getEthPriceCached(): Promise<number> {
  const now = Date.now();
  if (now > ethPriceCacheExpiry) {
    cachedEthPrice = await fetchEthPrice();
    ethPriceCacheExpiry = now + ETH_PRICE_CACHE_TTL;
  }
  return cachedEthPrice;
}

// ============================================
// EVENT PARSING
// ============================================

const GameCreatedEvent = parseAbiItem(
  'event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, uint256 amount, bool choice)'
);

const GameJoinedEvent = parseAbiItem(
  'event GameJoined(uint256 indexed gameId, address indexed joiner, uint256 totalPot)'
);

const GameResolvedEvent = parseAbiItem(
  'event GameResolved(uint256 indexed gameId, address indexed winner, address indexed loser, bool coinResult, uint256 payout)'
);

const GameCancelledEvent = parseAbiItem(
  'event GameCancelled(uint256 indexed gameId, address indexed creator, uint256 refundAmount)'
);

const GameAutoCancelledEvent = parseAbiItem(
  'event GameAutoCancelled(uint256 indexed gameId, address indexed creator, uint256 refundAmount, address indexed cancelledBy)'
);

const VrfTimeoutClaimedEvent = parseAbiItem(
  'event VrfTimeoutClaimed(uint256 indexed gameId, address indexed playerA, address indexed playerB, uint256 refundAmount)'
);

// ============================================
// CONTRACT READS
// ============================================

// Game struct from contract (matches ABI getGame output)
interface ContractGame {
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  tier: number;
  choiceA: boolean;
  state: number; // 0=NONE, 1=OPEN, 2=LOCKED, 3=RESOLVED, 4=CANCELLED
  createdBlock: bigint;
  lockedBlock: bigint;
  vrfRequestId: bigint;
  coinResult: boolean;
  winner: `0x${string}`;
}

// Player stats struct from contract
interface ContractPlayerStats {
  gamesPlayed: bigint;
  gamesWon: bigint;
  gamesLost: bigint;
  totalWagered: bigint;
  totalWon: bigint;
  totalLost: bigint;
}

// Contract configuration cache
interface ContractConfig {
  feeBasisPoints: number;
  maxGamesPerPlayer: number;
  timeoutBlocks: bigint;
  vrfTimeoutBlocks: bigint;
  expiresAt: number;
}

let cachedConfig: ContractConfig | null = null;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ContractTier interface defined earlier for cache usage

async function getGameFromContract(gameId: bigint): Promise<ContractGame | null> {
  const client = getClient();

  try {
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'getGame',
      args: [gameId],
    }) as ContractGame;

    return result;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading game:', error);
    return null;
  }
}

async function getTierFromContract(tierId: number): Promise<ContractTier | null> {
  const client = getClient();

  try {
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'getTier',
      args: [tierId],
    }) as ContractTier;

    return result;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading tier:', error);
    return null;
  }
}

async function getTierAmounts(): Promise<{ amount: bigint; enabled: boolean }[]> {
  const tiers: { amount: bigint; enabled: boolean }[] = [];

  // Read all 10 tiers (contract supports MAX_TIERS = 10)
  for (let i = 0; i < 10; i++) {
    const tier = await getTierCached(i);
    if (tier) {
      tiers.push({ amount: tier.amount, enabled: tier.enabled });
    }
  }

  return tiers;
}

// Get contract configuration (cached)
async function getContractConfig(): Promise<ContractConfig> {
  const now = Date.now();
  if (cachedConfig && now < cachedConfig.expiresAt) {
    return cachedConfig;
  }

  const client = getClient();

  try {
    const [feeBasisPoints, maxGamesPerPlayer, timeoutBlocks, vrfTimeoutBlocks] = await Promise.all([
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'feeBasisPoints',
      }) as Promise<number>,
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'maxGamesPerPlayer',
      }) as Promise<number>,
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'timeoutBlocks',
      }) as Promise<bigint>,
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'vrfTimeoutBlocks',
      }) as Promise<bigint>,
    ]);

    cachedConfig = {
      feeBasisPoints,
      maxGamesPerPlayer,
      timeoutBlocks,
      vrfTimeoutBlocks,
      expiresAt: now + CONFIG_CACHE_TTL,
    };

    devLog.log('[BlockchainDS] Contract config loaded:', {
      feeBasisPoints,
      maxGamesPerPlayer,
      timeoutBlocks: timeoutBlocks.toString(),
      vrfTimeoutBlocks: vrfTimeoutBlocks.toString(),
    });

    return cachedConfig;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading contract config:', error);
    // Return defaults if contract read fails
    return {
      feeBasisPoints: 300, // 3%
      maxGamesPerPlayer: 5,
      timeoutBlocks: 25n,
      vrfTimeoutBlocks: 200n,
      expiresAt: 0, // Don't cache on error
    };
  }
}

// Get player's active game count from contract
async function getActiveGameCountFromContract(address: string): Promise<number> {
  const client = getClient();

  try {
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'getActiveGameCount',
      args: [address as `0x${string}`],
    }) as number;

    return count;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading active game count:', error);
    return 0;
  }
}

// Check if player can create a new game (from contract)
async function canCreateGameFromContract(address: string): Promise<boolean> {
  const client = getClient();

  try {
    const canCreate = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'canCreateGame',
      args: [address as `0x${string}`],
    }) as boolean;

    return canCreate;
  } catch (error) {
    devLog.error('[BlockchainDS] Error checking canCreateGame:', error);
    return true; // Default to allowing if check fails
  }
}

// Get player stats from contract
async function getPlayerStatsFromContract(address: string): Promise<ContractPlayerStats | null> {
  const client = getClient();

  try {
    const stats = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'getPlayerStats',
      args: [address as `0x${string}`],
    }) as ContractPlayerStats;

    return stats;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading player stats:', error);
    return null;
  }
}

// Get all open game IDs from contract (efficient way to find pending games)
async function getOpenGameIdsFromContract(): Promise<bigint[]> {
  const client = getClient();

  try {
    const gameIds = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'getOpenGameIds',
    }) as bigint[];

    return gameIds;
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading open game IDs:', error);
    return [];
  }
}

// Calculate payout for a tier (from contract)
async function calculatePayoutFromContract(tierId: number): Promise<bigint> {
  const client = getClient();

  try {
    const payout = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      functionName: 'calculatePayout',
      args: [tierId],
    }) as bigint;

    return payout;
  } catch (error) {
    devLog.error('[BlockchainDS] Error calculating payout:', error);
    // Fallback: calculate with 3% fee
    const tier = await getTierCached(tierId);
    if (tier) {
      return (tier.amount * 2n * 97n) / 100n;
    }
    return 0n;
  }
}

// ============================================
// CONVERSION HELPERS
// ============================================

// Contract GameState enum: 0=NONE, 1=OPEN, 2=LOCKED, 3=RESOLVED, 4=CANCELLED
const STATUS_MAP: Record<number, Game['status']> = {
  0: 'pending',   // NONE - shouldn't happen for valid games, but map to pending as safe default
  1: 'pending',   // OPEN = waiting for player B
  2: 'matched',   // LOCKED = both players in, waiting for VRF
  3: 'resolved',  // RESOLVED = game complete
  4: 'cancelled', // CANCELLED
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function contractGameToGame(
  gameId: bigint,
  contractGame: ContractGame,
  txHash: string = '',
  createdAt: string = new Date().toISOString()
): Promise<Game> {
  const isZeroAddress = (addr: string) => addr === ZERO_ADDRESS;

  // Get tier info using cache (avoids redundant RPC calls)
  const tier = await getTierCached(contractGame.tier);
  const amount = tier?.amount.toString() || '0';

  return {
    id: gameId.toString(),
    tx_hash: txHash,
    tier: contractGame.tier,
    amount,
    creator_address: contractGame.playerA.toLowerCase(),
    creator_choice: contractGame.choiceA,
    joiner_address: isZeroAddress(contractGame.playerB) ? null : contractGame.playerB.toLowerCase(),
    joiner_choice: isZeroAddress(contractGame.playerB) ? null : !contractGame.choiceA, // Joiner always opposite
    status: STATUS_MAP[contractGame.state] || 'pending',
    winner_address: isZeroAddress(contractGame.winner) ? null : contractGame.winner.toLowerCase(),
    coin_result: contractGame.state === 2 ? contractGame.coinResult : null,
    payout: null, // Would need event parsing
    fee: null,
    block_number: contractGame.createdBlock.toString(),
    matched_tx_hash: null,
    matched_block_number: contractGame.lockedBlock > 0n ? contractGame.lockedBlock.toString() : null,
    resolved_tx_hash: null,
    resolved_block_number: null, // Not available in struct
    cancelled_tx_hash: null,
    cancelled_block_number: null,
    created_at: createdAt,
    matched_at: null,
    resolved_at: null,
    cancelled_at: null,
    updated_at: new Date().toISOString(),
    contract_address: CONTRACT_ADDRESS,
    contract_version: 4,
  };
}

// ============================================
// BLOCKCHAIN DATA SOURCE IMPLEMENTATION
// ============================================

export class BlockchainDataSource implements GameDataSource {
  readonly name = 'blockchain' as const;

  // Real-time if WebSocket is available
  get isRealtime(): boolean {
    return isWsAvailable();
  }

  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventWatchers: Map<string, WatchContractEventReturnType> = new Map();
  private gameCallbacks: Map<string, Set<(game: Game) => void>> = new Map();
  private allGamesCallbacks: Set<(games: Game[]) => void> = new Set();
  private cachedGames: Map<string, Game> = new Map();
  private knownGameIds: Set<string> = new Set();
  private lastBlockScanned: bigint = 0n;
  private scanInProgress: Promise<void> | null = null; // Mutex for concurrent scan prevention
  private globalWatcherInitialized = false;

  // ============================================
  // GAME QUERIES
  // ============================================

  async getGames(limit = 100): Promise<Game[]> {
    await this.scanForNewGames();
    const games = Array.from(this.cachedGames.values());
    // Sort by block number descending (most recent first)
    games.sort((a, b) => Number(BigInt(b.block_number) - BigInt(a.block_number)));

    return games.slice(0, limit);
  }

  private async scanForNewGames(): Promise<void> {
    if (this.scanInProgress) {
      return this.scanInProgress;
    }

    this.scanInProgress = this._doScan();
    try {
      await this.scanInProgress;
    } finally {
      this.scanInProgress = null;
    }
  }

  private async _doScan(): Promise<void> {
    const client = getClient();

    try {
      const headBlock = await client.getBlockNumber();
      // Query 2 blocks behind head to avoid "block range extends beyond current head"
      // errors from load-balanced RPC nodes where different nodes may be at different heights.
      const currentBlock = headBlock > FINALITY_LAG ? headBlock - FINALITY_LAG : headBlock;
      const fromBlock = this.lastBlockScanned > 0n
        ? this.lastBlockScanned + 1n
        : currentBlock - BigInt(MAX_BLOCK_RANGE);

      // Skip if we've already scanned up to or past current block
      if (fromBlock > currentBlock) {
        return;
      }

      const safeFrom = fromBlock > 0n ? fromBlock : 0n;

      // Fetch event logs in two rate-limited batches (instead of 6 parallel) to avoid hitting RPC limits
      const [createdLogs, joinedLogs, resolvedLogs] = await Promise.all([
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: GameCreatedEvent, fromBlock: safeFrom, toBlock: currentBlock })),
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: GameJoinedEvent, fromBlock: safeFrom, toBlock: currentBlock })),
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: GameResolvedEvent, fromBlock: safeFrom, toBlock: currentBlock })),
      ]);
      const [cancelledLogs, autoCancelledLogs, vrfTimeoutLogs] = await Promise.all([
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: GameCancelledEvent, fromBlock: safeFrom, toBlock: currentBlock })),
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: GameAutoCancelledEvent, fromBlock: safeFrom, toBlock: currentBlock })),
        withRpcLimit(() => client.getLogs({ address: CONTRACT_ADDRESS, event: VrfTimeoutClaimedEvent, fromBlock: safeFrom, toBlock: currentBlock })),
      ]);

      if (createdLogs.length + joinedLogs.length + resolvedLogs.length + cancelledLogs.length + autoCancelledLogs.length + vrfTimeoutLogs.length > 0) {
        devLog.log(`[BlockchainDS] Events found - Created: ${createdLogs.length}, Joined: ${joinedLogs.length}, Resolved: ${resolvedLogs.length}, Cancelled: ${cancelledLogs.length + autoCancelledLogs.length}`);
      }

      // Process GameCreated events - add new games to cache
      for (const log of createdLogs) {
        const gameId = log.args.gameId;
        const gameIdStr = gameId?.toString() || '';

        if (gameId && !this.knownGameIds.has(gameIdStr)) {
          this.knownGameIds.add(gameIdStr);
          try {
            const contractGame = await withRpcLimit(() => getGameFromContract(gameId));
            if (contractGame) {
              // Skip games with state 0 (NONE) - they don't actually exist
              if (contractGame.state === 0) {
                devLog.log(`[BlockchainDS] Skipping game ${gameIdStr} - state is NONE (doesn't exist)`);
                continue;
              }
              const game = await contractGameToGame(
                gameId,
                contractGame,
                log.transactionHash || '',
                new Date().toISOString()
              );
              this.cachedGames.set(game.id, game);
              devLog.log(`[BlockchainDS] Cached game ${game.id}: creator=${game.creator_address}, status=${game.status}`);
            } else {
              devLog.warn(`[BlockchainDS] getGameFromContract returned null for game ${gameIdStr}`);
            }
          } catch (error) {
            devLog.error(`[BlockchainDS] Error fetching game ${gameIdStr}:`, error);
            // Remove from knownGameIds so it can be retried
            this.knownGameIds.delete(gameIdStr);
          }
        }
      }

      // Process GameJoined events - update game to matched status
      for (const log of joinedLogs) {
        const gameId = log.args.gameId;
        if (gameId) {
          const gameIdStr = gameId.toString();
          const cachedGame = this.cachedGames.get(gameIdStr);
          if (cachedGame && cachedGame.status === 'pending') {
            // Refresh from contract to get full updated state
            const contractGame = await getGameFromContract(gameId);
            if (contractGame) {
              const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
              updatedGame.matched_tx_hash = log.transactionHash || null;
              this.cachedGames.set(gameIdStr, updatedGame);
              devLog.log(`[BlockchainDS] Game ${gameIdStr} updated to matched`);
            }
          }
        }
      }

      // Process GameResolved events - update game with winner info
      for (const log of resolvedLogs) {
        const gameId = log.args.gameId;
        if (gameId) {
          const gameIdStr = gameId.toString();
          const cachedGame = this.cachedGames.get(gameIdStr);
          if (cachedGame && (cachedGame.status === 'matched' || cachedGame.status === 'pending')) {
            // Refresh from contract to get full updated state
            const contractGame = await getGameFromContract(gameId);
            if (contractGame) {
              const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
              updatedGame.resolved_tx_hash = log.transactionHash || null;
              updatedGame.payout = log.args.payout?.toString() || null;
              // Calculate fee from payout: fee = totalPot - payout = 2*amount - payout
              if (log.args.payout && cachedGame.amount) {
                const totalPot = BigInt(cachedGame.amount) * 2n;
                const fee = totalPot - log.args.payout;
                updatedGame.fee = fee.toString();
              }
              updatedGame.resolved_at = new Date().toISOString();
              this.cachedGames.set(gameIdStr, updatedGame);
              devLog.log(`[BlockchainDS] Game ${gameIdStr} resolved - winner: ${log.args.winner}`);
            }
          }
        }
      }

      // Process GameCancelled and GameAutoCancelled events
      const allCancelledLogs = [...cancelledLogs, ...autoCancelledLogs];
      for (const log of allCancelledLogs) {
        const gameId = log.args.gameId;
        if (gameId) {
          const gameIdStr = gameId.toString();
          const cachedGame = this.cachedGames.get(gameIdStr);
          if (cachedGame && cachedGame.status !== 'cancelled') {
            const contractGame = await getGameFromContract(gameId);
            if (contractGame) {
              const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
              updatedGame.cancelled_tx_hash = log.transactionHash || null;
              updatedGame.cancelled_at = new Date().toISOString();
              this.cachedGames.set(gameIdStr, updatedGame);
              devLog.log(`[BlockchainDS] Game ${gameIdStr} cancelled`);
            }
          }
        }
      }

      // Process VrfTimeoutClaimed events - mark as cancelled with refund
      for (const log of vrfTimeoutLogs) {
        const gameId = log.args.gameId;
        if (gameId) {
          const gameIdStr = gameId.toString();
          const cachedGame = this.cachedGames.get(gameIdStr);
          if (cachedGame && cachedGame.status !== 'cancelled') {
            const contractGame = await getGameFromContract(gameId);
            if (contractGame) {
              const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
              updatedGame.cancelled_tx_hash = log.transactionHash || null;
              updatedGame.cancelled_at = new Date().toISOString();
              this.cachedGames.set(gameIdStr, updatedGame);
              devLog.log(`[BlockchainDS] Game ${gameIdStr} VRF timeout claimed`);
            }
          }
        }
      }

      this.lastBlockScanned = currentBlock;
    } catch (error) {
      devLog.error('[BlockchainDS] Error scanning for new games:', error);
    }
  }

  // Refresh active games' states from contract (for games that might have changed)
  private async refreshActiveGames(): Promise<void> {
    const activeGames = Array.from(this.cachedGames.values())
      .filter(g => g.status === 'pending' || g.status === 'matched');

    for (const game of activeGames) {
      try {
        const contractGame = await getGameFromContract(BigInt(game.id));
        if (contractGame) {
          const newStatus = STATUS_MAP[contractGame.state];
          if (newStatus !== game.status) {
            const updatedGame = await contractGameToGame(BigInt(game.id), contractGame, game.tx_hash, game.created_at);
            this.cachedGames.set(game.id, updatedGame);
            devLog.log(`[BlockchainDS] Game ${game.id} refreshed: ${game.status} -> ${newStatus}`);
          }
        }
      } catch (error) {
        devLog.error(`[BlockchainDS] Error refreshing game ${game.id}:`, error);
      }
    }
  }

  async getPendingGames(): Promise<Game[]> {
    // Use efficient contract method to get open game IDs directly
    try {
      const openGameIds = await getOpenGameIdsFromContract();

      if (openGameIds.length === 0) {
        return [];
      }

      // Fetch each game and add to cache
      const pendingGames: Game[] = [];
      for (const gameId of openGameIds) {
        const gameIdStr = gameId.toString();

        // Check cache first
        let game = this.cachedGames.get(gameIdStr);

        if (!game) {
          // Fetch from contract
          const contractGame = await getGameFromContract(gameId);
          if (contractGame && contractGame.state === 1) { // OPEN state
            game = await contractGameToGame(gameId, contractGame);
            this.cachedGames.set(gameIdStr, game);
            this.knownGameIds.add(gameIdStr);
          }
        }

        if (game && game.status === 'pending') {
          pendingGames.push(game);
        }
      }

      return pendingGames;
    } catch (error) {
      devLog.error('[BlockchainDS] Error getting pending games from contract, falling back to cache:', error);
      // Fallback to cache-based approach
      const games = await this.getGames(200);
      const pending = games.filter(g => g.status === 'pending');
      devLog.log(`[BlockchainDS] Fallback: Found ${pending.length} pending games out of ${games.length} total`);
      return pending;
    }
  }

  async getActiveGames(): Promise<Game[]> {
    const games = await this.getGames(200);
    return games.filter(g => g.status === 'pending' || g.status === 'matched');
  }

  async getGame(id: string): Promise<Game | null> {
    const cached = this.cachedGames.get(id);
    const contractGame = await withRpcLimit(() => getGameFromContract(BigInt(id)));
    if (contractGame) {
      const game = await contractGameToGame(BigInt(id), contractGame, cached?.tx_hash, cached?.created_at);
      this.cachedGames.set(id, game);
      return game;
    }
    return cached ?? null;
  }

  async getGameByTxHash(txHash: string): Promise<Game | null> {
    // Search cache first
    for (const game of this.cachedGames.values()) {
      if (game.tx_hash.toLowerCase() === txHash.toLowerCase()) {
        return game;
      }
    }

    // Would need event parsing to find by tx hash efficiently
    // For now, return null (Supabase mode handles this better)
    devLog.warn('[BlockchainDS] getGameByTxHash not fully supported in blockchain mode');
    return null;
  }

  // ============================================
  // PLAYER QUERIES
  // ============================================

  async getPlayerGames(address: string, limit = 50): Promise<Game[]> {
    const games = await this.getGames(500);
    const lowerAddress = address.toLowerCase();

    const playerGames = games.filter(g =>
      g.creator_address.toLowerCase() === lowerAddress ||
      g.joiner_address?.toLowerCase() === lowerAddress
    );

    return playerGames.slice(0, limit);
  }

  async getPlayerActiveGames(address: string): Promise<Game[]> {
    const games = await this.getPlayerGames(address, 100);
    return games.filter(g => g.status === 'pending' || g.status === 'matched');
  }

  async getPlayerStats(address: string): Promise<PlayerStats | null> {
    const lowerAddress = address.toLowerCase();

    // First try to get stats directly from contract (more accurate)
    try {
      const contractStats = await getPlayerStatsFromContract(address);
      if (contractStats) {
        const totalGames = Number(contractStats.gamesPlayed);
        const wins = Number(contractStats.gamesWon);
        const losses = Number(contractStats.gamesLost);
        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
        const netProfit = contractStats.totalWon - contractStats.totalLost;

        devLog.log('[BlockchainDS] Player stats from contract:', {
          address: lowerAddress,
          totalGames,
          wins,
          losses,
        });

        return {
          address: lowerAddress,
          totalGames,
          wins,
          losses,
          winRate,
          totalWagered: contractStats.totalWagered.toString(),
          totalWon: contractStats.totalWon.toString(),
          netProfit: netProfit.toString(),
        };
      }
    } catch (error) {
      devLog.warn('[BlockchainDS] Failed to get stats from contract, falling back to event-based:', error);
    }

    // Fallback: Calculate from events/cache
    const games = await this.getPlayerGames(address, 1000);

    let wins = 0;
    let losses = 0;
    let totalWagered = 0n;
    let totalWon = 0n;

    for (const game of games) {
      if (game.status === 'resolved') {
        totalWagered += BigInt(game.amount);

        if (game.winner_address?.toLowerCase() === lowerAddress) {
          wins++;
          if (game.payout) {
            totalWon += BigInt(game.payout);
          }
        } else {
          losses++;
        }
      }
    }

    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const netProfit = totalWon - totalWagered;

    return {
      address: lowerAddress,
      totalGames,
      wins,
      losses,
      winRate,
      totalWagered: totalWagered.toString(),
      totalWon: totalWon.toString(),
      netProfit: netProfit.toString(),
    };
  }

  // ============================================
  // CONTRACT CONFIGURATION & GAME LIMITS
  // ============================================

  async getContractConfig(): Promise<{
    feeBasisPoints: number;
    maxGamesPerPlayer: number;
    timeoutBlocks: number;
    vrfTimeoutBlocks: number;
  }> {
    const config = await getContractConfig();
    return {
      feeBasisPoints: config.feeBasisPoints,
      maxGamesPerPlayer: config.maxGamesPerPlayer,
      timeoutBlocks: Number(config.timeoutBlocks),
      vrfTimeoutBlocks: Number(config.vrfTimeoutBlocks),
    };
  }

  async getActiveGameCount(address: string): Promise<number> {
    return await getActiveGameCountFromContract(address);
  }

  async canCreateGame(address: string): Promise<boolean> {
    return await canCreateGameFromContract(address);
  }

  async calculatePayout(tierId: number): Promise<string> {
    const payout = await calculatePayoutFromContract(tierId);
    return payout.toString();
  }

  // ============================================
  // TIER QUERIES
  // ============================================

  async getTiers(): Promise<Tier[]> {
    const tiers = await getTierAmounts();
    const ethPrice = await getEthPriceCached();
    const config = await getContractConfig();

    // Calculate fee percentage from basis points (e.g., 300 = 3%)
    const feePercent = config.feeBasisPoints / 100;
    const payoutPercent = (100 - feePercent) / 100;

    return tiers.map((tier, index) => {
      const amountEth = Number(tier.amount) / 1e18;
      const amountUsd = Math.round(amountEth * ethPrice);
      // Total pot is 2x bet, minus fee
      const totalPot = tier.amount * 2n;
      const winAmount = (totalPot * BigInt(Math.round(payoutPercent * 10000))) / 10000n;
      const winAmountUsd = Math.round(amountUsd * 2 * payoutPercent);

      return {
        id: index,
        amount: tier.amount.toString(),
        amountUsd,
        winAmount: winAmount.toString(),
        winAmountUsd,
        enabled: tier.enabled,
      };
    });
  }

  async getPendingCountByTier(): Promise<Record<number, number>> {
    const pending = await this.getPendingGames();
    const counts: Record<number, number> = {};

    for (const game of pending) {
      counts[game.tier] = (counts[game.tier] || 0) + 1;
    }

    return counts;
  }

  // ============================================
  // GLOBAL STATS
  // ============================================

  async getGameStats(): Promise<GameStats> {
    const games = await this.getGames(1000);
    const uniquePlayers = new Set<string>();
    let totalVolume = 0n;

    let pending = 0, matched = 0, resolved = 0, cancelled = 0;

    for (const game of games) {
      uniquePlayers.add(game.creator_address.toLowerCase());
      if (game.joiner_address) {
        uniquePlayers.add(game.joiner_address.toLowerCase());
      }

      if (game.status === 'resolved') {
        totalVolume += BigInt(game.amount) * 2n;
      }

      switch (game.status) {
        case 'pending': pending++; break;
        case 'matched': matched++; break;
        case 'resolved': resolved++; break;
        case 'cancelled': cancelled++; break;
      }
    }

    return {
      totalGames: games.length,
      pendingGames: pending,
      matchedGames: matched,
      resolvedGames: resolved,
      cancelledGames: cancelled,
      totalVolume: totalVolume.toString(),
      uniquePlayers: uniquePlayers.size,
    };
  }

  // ============================================
  // SUBSCRIPTIONS (WebSocket real-time with polling fallback)
  // ============================================

  // Initialize global WebSocket event watchers (called once)
  private initGlobalEventWatchers(): void {
    if (this.globalWatcherInitialized) return;

    const wsClient = getWsClient();
    if (!wsClient) {
      devLog.log('[BlockchainDS] No WebSocket client, using polling mode');
      return;
    }

    devLog.log('[BlockchainDS] Initializing real-time WebSocket event watchers');
    this.globalWatcherInitialized = true;

    // Watch GameCreated events
    const unwatchCreated = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      eventName: 'GameCreated',
      onLogs: async (logs) => {
        for (const log of logs) {
          devLog.log('[BlockchainDS] ⚡ Real-time GameCreated event:', log.args);
          await this.handleGameCreatedEvent(log);
        }
        this.notifyAllGamesSubscribers();
      },
      onError: (error) => {
        devLog.error('[BlockchainDS] GameCreated watch error:', error);
      },
    });
    this.eventWatchers.set('GameCreated', unwatchCreated);

    // Watch GameJoined events
    const unwatchJoined = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      eventName: 'GameJoined',
      onLogs: async (logs) => {
        for (const log of logs) {
          devLog.log('[BlockchainDS] ⚡ Real-time GameJoined event:', log.args);
          await this.handleGameJoinedEvent(log);
        }
        this.notifyAllGamesSubscribers();
      },
      onError: (error) => {
        devLog.error('[BlockchainDS] GameJoined watch error:', error);
      },
    });
    this.eventWatchers.set('GameJoined', unwatchJoined);

    // Watch GameResolved events
    const unwatchResolved = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      eventName: 'GameResolved',
      onLogs: async (logs) => {
        for (const log of logs) {
          devLog.log('[BlockchainDS] ⚡ Real-time GameResolved event:', log.args);
          await this.handleGameResolvedEvent(log);
        }
        this.notifyAllGamesSubscribers();
      },
      onError: (error) => {
        devLog.error('[BlockchainDS] GameResolved watch error:', error);
      },
    });
    this.eventWatchers.set('GameResolved', unwatchResolved);

    // Watch GameCancelled events
    const unwatchCancelled = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      eventName: 'GameCancelled',
      onLogs: async (logs) => {
        for (const log of logs) {
          devLog.log('[BlockchainDS] ⚡ Real-time GameCancelled event:', log.args);
          await this.handleGameCancelledEvent(log);
        }
        this.notifyAllGamesSubscribers();
      },
      onError: (error) => {
        devLog.error('[BlockchainDS] GameCancelled watch error:', error);
      },
    });
    this.eventWatchers.set('GameCancelled', unwatchCancelled);

    // Watch GameAutoCancelled events
    const unwatchAutoCancelled = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: COINFLIP_ABI,
      eventName: 'GameAutoCancelled',
      onLogs: async (logs) => {
        for (const log of logs) {
          devLog.log('[BlockchainDS] ⚡ Real-time GameAutoCancelled event:', log.args);
          await this.handleGameCancelledEvent(log);
        }
        this.notifyAllGamesSubscribers();
      },
      onError: (error) => {
        devLog.error('[BlockchainDS] GameAutoCancelled watch error:', error);
      },
    });
    this.eventWatchers.set('GameAutoCancelled', unwatchAutoCancelled);

    devLog.log('[BlockchainDS] ✅ Real-time event watchers active');
  }

  // Handle real-time GameCreated event
  private async handleGameCreatedEvent(log: { args: { gameId?: bigint }; transactionHash?: string; blockNumber?: bigint }): Promise<void> {
    const gameId = log.args.gameId;
    if (!gameId) return;

    const gameIdStr = gameId.toString();
    if (this.knownGameIds.has(gameIdStr)) return;

    this.knownGameIds.add(gameIdStr);
    const contractGame = await getGameFromContract(gameId);
    if (contractGame) {
      const game = await contractGameToGame(
        gameId,
        contractGame,
        log.transactionHash || '',
        new Date().toISOString()
      );
      this.cachedGames.set(gameIdStr, game);
      this.notifyGameSubscribers(gameIdStr, game);
    }
  }

  // Handle real-time GameJoined event
  private async handleGameJoinedEvent(log: { args: { gameId?: bigint }; transactionHash?: string }): Promise<void> {
    const gameId = log.args.gameId;
    if (!gameId) return;

    const gameIdStr = gameId.toString();
    const cachedGame = this.cachedGames.get(gameIdStr);
    if (cachedGame) {
      const contractGame = await getGameFromContract(gameId);
      if (contractGame) {
        const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
        updatedGame.matched_tx_hash = log.transactionHash || null;
        this.cachedGames.set(gameIdStr, updatedGame);
        this.notifyGameSubscribers(gameIdStr, updatedGame);
      }
    }
  }

  // Handle real-time GameResolved event
  private async handleGameResolvedEvent(log: { args: { gameId?: bigint; payout?: bigint }; transactionHash?: string }): Promise<void> {
    const gameId = log.args.gameId;
    if (!gameId) return;

    const gameIdStr = gameId.toString();
    const cachedGame = this.cachedGames.get(gameIdStr);
    if (cachedGame) {
      const contractGame = await getGameFromContract(gameId);
      if (contractGame) {
        const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
        updatedGame.resolved_tx_hash = log.transactionHash || null;
        updatedGame.payout = log.args.payout?.toString() || null;
        if (log.args.payout && cachedGame.amount) {
          const totalPot = BigInt(cachedGame.amount) * 2n;
          const fee = totalPot - log.args.payout;
          updatedGame.fee = fee.toString();
        }
        updatedGame.resolved_at = new Date().toISOString();
        this.cachedGames.set(gameIdStr, updatedGame);
        this.notifyGameSubscribers(gameIdStr, updatedGame);
      }
    }
  }

  // Handle real-time GameCancelled event
  private async handleGameCancelledEvent(log: { args: { gameId?: bigint }; transactionHash?: string }): Promise<void> {
    const gameId = log.args.gameId;
    if (!gameId) return;

    const gameIdStr = gameId.toString();
    const cachedGame = this.cachedGames.get(gameIdStr);
    if (cachedGame && cachedGame.status !== 'cancelled') {
      const contractGame = await getGameFromContract(gameId);
      if (contractGame) {
        const updatedGame = await contractGameToGame(gameId, contractGame, cachedGame.tx_hash, cachedGame.created_at);
        updatedGame.cancelled_tx_hash = log.transactionHash || null;
        updatedGame.cancelled_at = new Date().toISOString();
        this.cachedGames.set(gameIdStr, updatedGame);
        this.notifyGameSubscribers(gameIdStr, updatedGame);
      }
    }
  }

  // Notify individual game subscribers
  private notifyGameSubscribers(gameId: string, game: Game): void {
    const callbacks = this.gameCallbacks.get(gameId);
    if (callbacks) {
      callbacks.forEach(cb => cb(game));
    }
  }

  // Notify all-games subscribers
  private notifyAllGamesSubscribers(): void {
    this.getActiveGames().then(games => {
      this.allGamesCallbacks.forEach(cb => cb(games));
    });
  }

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    // Initialize WebSocket watchers if available
    this.initGlobalEventWatchers();

    // Register callback for this game
    if (!this.gameCallbacks.has(gameId)) {
      this.gameCallbacks.set(gameId, new Set());
    }
    this.gameCallbacks.get(gameId)!.add(callback);

    // Always use polling for individual games (WebSocket may not catch all updates)
    let lastStatus: string | null = null;
    const intervalId = setInterval(async () => {
      const game = await this.getGame(gameId);
      if (game && game.status !== lastStatus) {
        lastStatus = game.status;
        callback(game);
      }
    }, ACTIVE_GAME_REFRESH_INTERVAL);
    this.pollingIntervals.set(`game-${gameId}`, intervalId);

    // Immediate first fetch
    this.getGame(gameId).then(game => {
      if (game) {
        lastStatus = game.status;
        callback(game);
      }
    });

    return () => {
      // Remove callback
      const callbacks = this.gameCallbacks.get(gameId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.gameCallbacks.delete(gameId);
        }
      }
      // Clear polling interval
      const intervalId = this.pollingIntervals.get(`game-${gameId}`);
      if (intervalId) {
        clearInterval(intervalId);
        this.pollingIntervals.delete(`game-${gameId}`);
      }
    };
  }

  subscribeToPlayerGames(address: string, callback: (games: Game[]) => void): () => void {
    // Initialize WebSocket watchers if available
    this.initGlobalEventWatchers();

    const lowerAddress = address.toLowerCase();

    // Create a wrapper that filters games for this player
    const playerCallback = (games: Game[]) => {
      const playerGames = games.filter(g =>
        g.creator_address.toLowerCase() === lowerAddress ||
        g.joiner_address?.toLowerCase() === lowerAddress
      );
      callback(playerGames);
    };

    // Register for all games updates
    this.allGamesCallbacks.add(playerCallback);

    // Always use polling as backup
    const pollInterval = isWsAvailable() ? POLLING_INTERVAL * 2 : POLLING_INTERVAL;
    const intervalId = setInterval(async () => {
      await this.scanForNewGames();
      await this.refreshActiveGames();
      const games = await this.getPlayerActiveGames(address);
      callback(games);
    }, pollInterval);
    this.pollingIntervals.set(`player-${address}`, intervalId);

    // Immediate first fetch with scan
    this.scanForNewGames().then(() => {
      this.getPlayerActiveGames(address).then(callback);
    });

    return () => {
      this.allGamesCallbacks.delete(playerCallback);
      const intervalId = this.pollingIntervals.get(`player-${address}`);
      if (intervalId) {
        clearInterval(intervalId);
        this.pollingIntervals.delete(`player-${address}`);
      }
    };
  }

  subscribeToAllGames(callback: (games: Game[]) => void): () => void {
    // Initialize WebSocket watchers if available
    this.initGlobalEventWatchers();

    // Register callback
    this.allGamesCallbacks.add(callback);

    // Always use polling as backup (WebSocket may fail silently)
    // Even with WebSocket, poll less frequently as safety net
    const pollInterval = isWsAvailable() ? POLLING_INTERVAL * 2 : POLLING_INTERVAL;
    const intervalId = setInterval(async () => {
      await this.scanForNewGames();
      await this.refreshActiveGames();
      const games = await this.getActiveGames();
      callback(games);
    }, pollInterval);
    this.pollingIntervals.set('all-games', intervalId);

    // Immediate first fetch with scan
    this.scanForNewGames().then(() => {
      this.getActiveGames().then(callback);
    });

    return () => {
      this.allGamesCallbacks.delete(callback);
      const intervalId = this.pollingIntervals.get('all-games');
      if (intervalId) {
        clearInterval(intervalId);
        this.pollingIntervals.delete('all-games');
      }
    };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async isAvailable(): Promise<boolean> {
    try {
      const client = getClient();
      await client.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy(): void {
    // Clear polling intervals
    for (const intervalId of this.pollingIntervals.values()) {
      clearInterval(intervalId);
    }
    this.pollingIntervals.clear();

    // Clear WebSocket event watchers
    for (const unwatch of this.eventWatchers.values()) {
      unwatch();
    }
    this.eventWatchers.clear();
    this.globalWatcherInitialized = false;

    // Clear callbacks
    this.gameCallbacks.clear();
    this.allGamesCallbacks.clear();

    // Clear cache
    this.cachedGames.clear();
    this.knownGameIds.clear();
  }
}

// Singleton instance
let blockchainDataSource: BlockchainDataSource | null = null;

export function getBlockchainDataSource(): BlockchainDataSource {
  if (!blockchainDataSource) {
    blockchainDataSource = new BlockchainDataSource();
  }
  return blockchainDataSource;
}
