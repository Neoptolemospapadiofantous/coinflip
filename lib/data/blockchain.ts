/**
 * Blockchain Data Source
 *
 * Reads game data directly from the blockchain via RPC.
 * Used in decentralized mode when user is not logged in.
 *
 * Features:
 * - Direct contract reads (no centralized database)
 * - Event log parsing for game history
 * - Polling-based updates (no realtime)
 * - Works offline from Supabase
 *
 * Limitations:
 * - Slower than indexed database
 * - No complex queries (sorting, filtering limited)
 * - Polling instead of realtime
 */

import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem';
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

const CONTRACT_ADDRESS = getCoinFlipAddress(11155111); // Sepolia
const POLLING_INTERVAL = 12000; // 12 seconds (1 block)
const MAX_BLOCK_RANGE = 10000; // Max blocks to scan per query

// Log contract address on load (for debugging)
if (typeof window !== 'undefined') {
  devLog.log('[BlockchainDS] Contract address:', CONTRACT_ADDRESS);
}

// ============================================
// CLIENT SETUP
// ============================================

let publicClient: PublicClient | null = null;

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

// Reset client (useful if RPC fails and needs reconnection)
export function resetBlockchainClient(): void {
  publicClient = null;
}

// ============================================
// EVENT PARSING
// ============================================

const GameCreatedEvent = parseAbiItem(
  'event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, uint256 amount, bool choice)'
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
  state: number; // 0=Open, 1=Locked, 2=Resolved, 3=Cancelled
  createdBlock: bigint;
  lockedBlock: bigint;
  vrfRequestId: bigint;
  coinResult: boolean;
  winner: `0x${string}`;
}

// Tier struct from contract
interface ContractTier {
  amount: bigint;
  enabled: boolean;
  totalGames: bigint;
  totalVolume: bigint;
}

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

  // Read tier amounts (typically 5 tiers: 0-4)
  for (let i = 0; i < 5; i++) {
    const tier = await getTierFromContract(i);
    if (tier) {
      tiers.push({ amount: tier.amount, enabled: tier.enabled });
    }
  }

  return tiers;
}

// ============================================
// CONVERSION HELPERS
// ============================================

// Contract states: 0=Open, 1=Locked, 2=Resolved, 3=Cancelled
const STATUS_MAP: Record<number, Game['status']> = {
  0: 'pending',   // Open = waiting for player B
  1: 'matched',   // Locked = both players in, waiting for VRF
  2: 'resolved',  // Resolved = game complete
  3: 'cancelled', // Cancelled
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function contractGameToGame(
  gameId: bigint,
  contractGame: ContractGame,
  txHash: string = '',
  createdAt: string = new Date().toISOString()
): Promise<Game> {
  const isZeroAddress = (addr: string) => addr === ZERO_ADDRESS;

  // Get tier info to get the amount
  const tier = await getTierFromContract(contractGame.tier);
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
    contract_version: 2,
  };
}

// ============================================
// BLOCKCHAIN DATA SOURCE IMPLEMENTATION
// ============================================

export class BlockchainDataSource implements GameDataSource {
  readonly name = 'blockchain' as const;
  readonly isRealtime = false;

  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private cachedGames: Map<string, Game> = new Map();
  private knownGameIds: Set<string> = new Set();
  private lastBlockScanned: bigint = 0n;

  // ============================================
  // GAME QUERIES
  // ============================================

  async getGames(limit = 100): Promise<Game[]> {
    devLog.log('[BlockchainDS] getGames called, cached:', this.cachedGames.size);
    // Use cached games - scan for new ones via events
    await this.scanForNewGames();

    const games = Array.from(this.cachedGames.values());
    devLog.log(`[BlockchainDS] After scan, total games in cache: ${games.length}`);
    // Sort by block number descending (most recent first)
    games.sort((a, b) => Number(BigInt(b.block_number) - BigInt(a.block_number)));

    return games.slice(0, limit);
  }

  private async scanForNewGames(): Promise<void> {
    const client = getClient();
    devLog.log('[BlockchainDS] scanForNewGames called');

    try {
      const currentBlock = await client.getBlockNumber();
      devLog.log(`[BlockchainDS] Current block: ${currentBlock}`);
      const fromBlock = this.lastBlockScanned > 0n
        ? this.lastBlockScanned + 1n
        : currentBlock - BigInt(MAX_BLOCK_RANGE);

      // Skip if we've already scanned up to or past current block
      if (fromBlock > currentBlock) {
        devLog.log('[BlockchainDS] No new blocks to scan');
        return;
      }

      // Get GameCreated events
      devLog.log(`[BlockchainDS] Fetching logs from block ${fromBlock} to ${currentBlock}`);
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: GameCreatedEvent,
        fromBlock: fromBlock > 0n ? fromBlock : 0n,
        toBlock: currentBlock,
      });
      devLog.log(`[BlockchainDS] Found ${logs.length} GameCreated events`);

      for (const log of logs) {
        const gameId = log.args.gameId;
        if (gameId && !this.knownGameIds.has(gameId.toString())) {
          this.knownGameIds.add(gameId.toString());
          const contractGame = await getGameFromContract(gameId);
          if (contractGame) {
            const game = await contractGameToGame(
              gameId,
              contractGame,
              log.transactionHash || '',
              new Date().toISOString()
            );
            this.cachedGames.set(game.id, game);
          }
        }
      }

      this.lastBlockScanned = currentBlock;
    } catch (error) {
      devLog.error('[BlockchainDS] Error scanning for new games:', error);
    }
  }

  async getPendingGames(): Promise<Game[]> {
    devLog.log('[BlockchainDS] getPendingGames called');
    const games = await this.getGames(200);
    const pending = games.filter(g => g.status === 'pending');
    devLog.log(`[BlockchainDS] Found ${pending.length} pending games out of ${games.length} total`);
    return pending;
  }

  async getActiveGames(): Promise<Game[]> {
    const games = await this.getGames(200);
    return games.filter(g => g.status === 'pending' || g.status === 'matched');
  }

  async getGame(id: string): Promise<Game | null> {
    // Check cache first
    const cached = this.cachedGames.get(id);
    if (cached) {
      // Refresh from chain
      const contractGame = await getGameFromContract(BigInt(id));
      if (contractGame) {
        const game = await contractGameToGame(BigInt(id), contractGame, cached.tx_hash, cached.created_at);
        this.cachedGames.set(id, game);
        return game;
      }
    }

    const contractGame = await getGameFromContract(BigInt(id));
    if (contractGame) {
      const game = await contractGameToGame(BigInt(id), contractGame);
      this.cachedGames.set(id, game);
      return game;
    }

    return null;
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

    return games
      .filter(g =>
        g.creator_address.toLowerCase() === lowerAddress ||
        g.joiner_address?.toLowerCase() === lowerAddress
      )
      .slice(0, limit);
  }

  async getPlayerActiveGames(address: string): Promise<Game[]> {
    const games = await this.getPlayerGames(address, 100);
    return games.filter(g => g.status === 'pending' || g.status === 'matched');
  }

  async getPlayerStats(address: string): Promise<PlayerStats | null> {
    const games = await this.getPlayerGames(address, 1000);
    const lowerAddress = address.toLowerCase();

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
  // TIER QUERIES
  // ============================================

  async getTiers(): Promise<Tier[]> {
    const tiers = await getTierAmounts();
    const ethPrice = 3000; // TODO: Fetch real price

    return tiers.map((tier, index) => {
      const amountEth = Number(tier.amount) / 1e18;
      const amountUsd = Math.round(amountEth * ethPrice);
      const winAmountUsd = Math.round(amountUsd * 1.9); // 95% of pot

      return {
        id: index,
        amount: tier.amount.toString(),
        amountUsd,
        winAmount: (tier.amount * 19n / 10n).toString(),
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
  // SUBSCRIPTIONS (Polling-based)
  // ============================================

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    const intervalId = setInterval(async () => {
      const game = await this.getGame(gameId);
      if (game) {
        callback(game);
      }
    }, POLLING_INTERVAL);

    this.pollingIntervals.set(`game-${gameId}`, intervalId);

    return () => {
      clearInterval(intervalId);
      this.pollingIntervals.delete(`game-${gameId}`);
    };
  }

  subscribeToPlayerGames(address: string, callback: (games: Game[]) => void): () => void {
    const intervalId = setInterval(async () => {
      const games = await this.getPlayerActiveGames(address);
      callback(games);
    }, POLLING_INTERVAL);

    this.pollingIntervals.set(`player-${address}`, intervalId);

    return () => {
      clearInterval(intervalId);
      this.pollingIntervals.delete(`player-${address}`);
    };
  }

  subscribeToAllGames(callback: (games: Game[]) => void): () => void {
    const intervalId = setInterval(async () => {
      const games = await this.getActiveGames();
      callback(games);
    }, POLLING_INTERVAL);

    this.pollingIntervals.set('all-games', intervalId);

    return () => {
      clearInterval(intervalId);
      this.pollingIntervals.delete('all-games');
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
    for (const intervalId of this.pollingIntervals.values()) {
      clearInterval(intervalId);
    }
    this.pollingIntervals.clear();
    this.cachedGames.clear();
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
