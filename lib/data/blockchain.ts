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
import { getContractAddress } from '@/lib/contracts/addresses';
import { devLog } from '@/lib/utils';

// ============================================
// CONFIGURATION
// ============================================

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://eth-sepolia.public.blastapi.io';
const CONTRACT_ADDRESS = getContractAddress('coinflip');
const POLLING_INTERVAL = 12000; // 12 seconds (1 block)
const MAX_BLOCK_RANGE = 10000; // Max blocks to scan per query

// ============================================
// CLIENT SETUP
// ============================================

let publicClient: PublicClient | null = null;

function getClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });
  }
  return publicClient;
}

// ============================================
// EVENT PARSING
// ============================================

const GameCreatedEvent = parseAbiItem(
  'event GameCreated(uint256 indexed gameId, address indexed creator, uint256 tier, uint256 amount)'
);

const GameMatchedEvent = parseAbiItem(
  'event GameMatched(uint256 indexed gameId, address indexed joiner)'
);

const GameResolvedEvent = parseAbiItem(
  'event GameResolved(uint256 indexed gameId, address indexed winner, uint256 payout, bool coinResult)'
);

const GameCancelledEvent = parseAbiItem(
  'event GameCancelled(uint256 indexed gameId)'
);

// ============================================
// CONTRACT READS
// ============================================

interface ContractGame {
  creator: `0x${string}`;
  creatorChoice: boolean;
  joiner: `0x${string}`;
  joinerChoice: boolean;
  amount: bigint;
  tier: number;
  status: number; // 0=pending, 1=matched, 2=resolved, 3=cancelled
  winner: `0x${string}`;
  randomNumber: bigint;
  createdBlock: bigint;
  matchedBlock: bigint;
  resolvedBlock: bigint;
}

async function getGameFromContract(gameId: bigint): Promise<ContractGame | null> {
  const client = getClient();

  try {
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: COINFLIP_ABI,
      functionName: 'games',
      args: [gameId],
    }) as unknown[];

    // Parse the tuple response
    return {
      creator: result[0] as `0x${string}`,
      creatorChoice: result[1] as boolean,
      joiner: result[2] as `0x${string}`,
      joinerChoice: result[3] as boolean,
      amount: result[4] as bigint,
      tier: Number(result[5]),
      status: Number(result[6]),
      winner: result[7] as `0x${string}`,
      randomNumber: result[8] as bigint,
      createdBlock: result[9] as bigint,
      matchedBlock: result[10] as bigint,
      resolvedBlock: result[11] as bigint,
    };
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading game:', error);
    return null;
  }
}

async function getGameCount(): Promise<bigint> {
  const client = getClient();

  try {
    const count = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: COINFLIP_ABI,
      functionName: 'gameCount',
    });
    return count as bigint;
  } catch (error) {
    devLog.error('[BlockchainDS] Error getting game count:', error);
    return 0n;
  }
}

async function getTierAmounts(): Promise<bigint[]> {
  const client = getClient();
  const amounts: bigint[] = [];

  try {
    // Read tier amounts (typically 5 tiers: 0-4)
    for (let i = 0; i < 5; i++) {
      const amount = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: COINFLIP_ABI,
        functionName: 'tierAmounts',
        args: [BigInt(i)],
      });
      amounts.push(amount as bigint);
    }
  } catch (error) {
    devLog.error('[BlockchainDS] Error reading tier amounts:', error);
  }

  return amounts;
}

// ============================================
// CONVERSION HELPERS
// ============================================

const STATUS_MAP: Record<number, Game['status']> = {
  0: 'pending',
  1: 'matched',
  2: 'resolved',
  3: 'cancelled',
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function contractGameToGame(
  gameId: bigint,
  contractGame: ContractGame,
  txHash: string = '',
  createdAt: string = new Date().toISOString()
): Game {
  const isZeroAddress = (addr: string) => addr === ZERO_ADDRESS;

  return {
    id: gameId.toString(),
    tx_hash: txHash,
    tier: contractGame.tier,
    amount: contractGame.amount.toString(),
    creator_address: contractGame.creator.toLowerCase(),
    creator_choice: contractGame.creatorChoice,
    joiner_address: isZeroAddress(contractGame.joiner) ? null : contractGame.joiner.toLowerCase(),
    joiner_choice: isZeroAddress(contractGame.joiner) ? null : contractGame.joinerChoice,
    status: STATUS_MAP[contractGame.status] || 'pending',
    winner_address: isZeroAddress(contractGame.winner) ? null : contractGame.winner.toLowerCase(),
    coin_result: contractGame.status === 2 ? (contractGame.randomNumber % 2n === 1n) : null,
    payout: null, // Would need event parsing
    fee: null,
    block_number: contractGame.createdBlock.toString(),
    matched_tx_hash: null,
    matched_block_number: contractGame.matchedBlock > 0n ? contractGame.matchedBlock.toString() : null,
    resolved_tx_hash: null,
    resolved_block_number: contractGame.resolvedBlock > 0n ? contractGame.resolvedBlock.toString() : null,
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
  private lastBlockChecked: bigint = 0n;

  // ============================================
  // GAME QUERIES
  // ============================================

  async getGames(limit = 100): Promise<Game[]> {
    const gameCount = await getGameCount();
    const games: Game[] = [];

    // Read latest games (most recent first)
    const start = gameCount > BigInt(limit) ? gameCount - BigInt(limit) : 1n;

    for (let i = gameCount; i >= start && i > 0n; i--) {
      const contractGame = await getGameFromContract(i);
      if (contractGame) {
        const game = contractGameToGame(i, contractGame);
        games.push(game);
        this.cachedGames.set(game.id, game);
      }
    }

    return games;
  }

  async getPendingGames(): Promise<Game[]> {
    const games = await this.getGames(200);
    return games.filter(g => g.status === 'pending');
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
        const game = contractGameToGame(BigInt(id), contractGame, cached.tx_hash, cached.created_at);
        this.cachedGames.set(id, game);
        return game;
      }
    }

    const contractGame = await getGameFromContract(BigInt(id));
    if (contractGame) {
      const game = contractGameToGame(BigInt(id), contractGame);
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
    const amounts = await getTierAmounts();
    const ethPrice = 3000; // TODO: Fetch real price

    return amounts.map((amount, index) => {
      const amountEth = Number(amount) / 1e18;
      const amountUsd = Math.round(amountEth * ethPrice);
      const winAmountUsd = Math.round(amountUsd * 1.9); // 95% of pot

      return {
        id: index,
        amount: amount.toString(),
        amountUsd,
        winAmount: (amount * 19n / 10n).toString(),
        winAmountUsd,
        enabled: true,
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
