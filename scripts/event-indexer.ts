/**
 * Event Indexer for CoinFlip Contract
 *
 * Syncs blockchain events to Supabase database:
 * - GameCreated: New game created
 * - GameMatched: Second player joined
 * - GameResolved: VRF determined winner
 * - GameCancelled: Creator cancelled before match
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createPublicClient, http, webSocket, parseAbiItem, fallback } from 'viem';
import { sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { COINFLIP_ABI } from '../lib/contracts/abi';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required service key - indexer requires elevated permissions
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is required for the indexer.');
  console.error('   The indexer needs service-level permissions to write to the database.');
  console.error('   Set SUPABASE_SERVICE_ROLE_KEY in your .env.local file.');
  process.exit(1);
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA! as `0x${string}`;
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const WSS_URL = process.env.SEPOLIA_WSS_URL; // Optional WebSocket URL for real-time events

// Determine if WebSocket is available
const useWebSocket = !!WSS_URL;

// Initialize clients with WebSocket support (fallback to HTTP if WSS not available)
const publicClient = createPublicClient({
  chain: sepolia,
  transport: useWebSocket
    ? fallback([
        webSocket(WSS_URL!, {
          reconnect: {
            attempts: 10,
            delay: 1000,
          },
        }),
        http(RPC_URL), // Fallback to HTTP if WebSocket fails
      ])
    : http(RPC_URL),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Log transport mode
console.log(`🔌 Transport: ${useWebSocket ? 'WebSocket (real-time)' : 'HTTP (polling)'}`);
if (useWebSocket) {
  console.log(`   WSS URL: ${WSS_URL?.replace(/\/\/.*@/, '//<redacted>@')}`);
}

// Retry helper for database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`⚠️ Operation failed, retrying (${i + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Sync contract configuration to database
async function syncContractConfig(blockNumber: bigint) {
  console.log('📋 Syncing contract configuration...');

  try {
    // Read contract state variables (V4 uses camelCase configurable params)
    const [
      feeBasisPoints,
      timeoutBlocks,
      vrfTimeoutBlocks,
      activeTierCount,
      collectedFees,
    ] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'feeBasisPoints',
      }) as Promise<number>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'timeoutBlocks',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'vrfTimeoutBlocks',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'activeTierCount',
      }) as Promise<number>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'collectedFees',
      }) as Promise<bigint>,
    ]);

    // Read tier amounts using getTier function
    const tierAmounts: { tier: number; amount: string; enabled: boolean; totalGames: string; totalVolume: string }[] = [];
    for (let i = 0; i < activeTierCount; i++) {
      const tier = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: 'getTier',
        args: [i],
      }) as { amount: bigint; enabled: boolean; totalGames: bigint; totalVolume: bigint };
      tierAmounts.push({
        tier: i,
        amount: tier.amount.toString(),
        enabled: tier.enabled,
        totalGames: tier.totalGames.toString(),
        totalVolume: tier.totalVolume.toString(),
      });
    }

    // Upsert config to database
    const { error } = await supabase.from('contract_config').upsert({
      id: 'current',
      contract_address: CONTRACT_ADDRESS.toLowerCase(),
      network: 'sepolia',
      fee_basis_points: Number(feeBasisPoints),
      timeout_blocks: Number(timeoutBlocks),
      vrf_timeout_blocks: Number(vrfTimeoutBlocks),
      tier_amounts: tierAmounts,
      active_tier_count: Number(activeTierCount),
      contract_version: 4, // V4 contract with configurable params
      last_synced_block: blockNumber.toString(),
      last_synced_at: new Date().toISOString(),
    });

    if (error) {
      console.error('❌ Error syncing contract config:', error);
    } else {
      console.log(`✅ Contract config synced:
  - Fee: ${Number(feeBasisPoints) / 100}%
  - Timeout: ${timeoutBlocks} blocks
  - VRF Timeout: ${vrfTimeoutBlocks} blocks
  - Active Tiers: ${activeTierCount}
  - Collected Fees: ${Number(collectedFees) / 1e18} ETH
  - Tier Amounts: ${tierAmounts.map(t => `${Number(t.amount) / 1e18} ETH`).join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Failed to sync contract config:', error);
  }
}

// Event signatures (must match contract exactly!)
const GAME_CREATED_EVENT = parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, uint256 amount, bool choice)');
const GAME_MATCHED_EVENT = parseAbiItem('event GameJoined(uint256 indexed gameId, address indexed joiner, uint256 totalPot)');
const GAME_RESOLVED_EVENT = parseAbiItem('event GameResolved(uint256 indexed gameId, address indexed winner, address indexed loser, bool coinResult, uint256 payout)');
const GAME_CANCELLED_EVENT = parseAbiItem('event GameCancelled(uint256 indexed gameId, address indexed creator, uint256 refundAmount)');
const GAME_AUTO_CANCELLED_EVENT = parseAbiItem('event GameAutoCancelled(uint256 indexed gameId, address indexed creator, uint256 refundAmount, address indexed cancelledBy)');
const VRF_TIMEOUT_EVENT = parseAbiItem('event VrfTimeoutClaimed(uint256 indexed gameId, address indexed playerA, address indexed playerB, uint256 refundAmount)');
const EMERGENCY_REFUND_EVENT = parseAbiItem('event EmergencyRefund(uint256 indexed gameId, address indexed playerA, address indexed playerB, uint256 totalRefund)');

interface IndexerState {
  lastProcessedBlock: bigint;
}

// Type-safe event log interfaces
interface BaseEventLog {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

interface GameCreatedLog extends BaseEventLog {
  args: {
    gameId: bigint;
    creator: `0x${string}`;
    tier: number;
    amount: bigint;
    choice: boolean;
  };
}

interface GameJoinedLog extends BaseEventLog {
  args: {
    gameId: bigint;
    joiner: `0x${string}`;
    totalPot: bigint;
  };
}

interface GameResolvedLog extends BaseEventLog {
  args: {
    gameId: bigint;
    winner: `0x${string}`;
    loser: `0x${string}`;
    coinResult: boolean;
    payout: bigint;
  };
}

interface GameCancelledLog extends BaseEventLog {
  args: {
    gameId: bigint;
    creator: `0x${string}`;
    refundAmount: bigint;
  };
}

interface GameAutoCancelledLog extends BaseEventLog {
  args: {
    gameId: bigint;
    creator: `0x${string}`;
    refundAmount: bigint;
    cancelledBy: `0x${string}`;
  };
}

interface VrfTimeoutClaimedLog extends BaseEventLog {
  args: {
    gameId: bigint;
    playerA: `0x${string}`;
    playerB: `0x${string}`;
    refundAmount: bigint;
  };
}

interface EmergencyRefundLog extends BaseEventLog {
  args: {
    gameId: bigint;
    playerA: `0x${string}`;
    playerB: `0x${string}`;
    totalRefund: bigint;
  };
}

// Union type for processed logs with type discriminator
interface TypedLog extends BaseEventLog {
  type: 'created' | 'joined' | 'resolved' | 'cancelled' | 'auto_cancelled' | 'vrf_timeout' | 'emergency_refund';
  args: GameCreatedLog['args'] | GameJoinedLog['args'] | GameResolvedLog['args'] |
        GameCancelledLog['args'] | GameAutoCancelledLog['args'] |
        VrfTimeoutClaimedLog['args'] | EmergencyRefundLog['args'];
}

// Load/save indexer state
async function loadState(): Promise<IndexerState> {
  const { data } = await supabase
    .from('indexer_state')
    .select('last_processed_block')
    .eq('indexer_name', 'coinflip_events')
    .single();

  return {
    lastProcessedBlock: data?.last_processed_block ? BigInt(data.last_processed_block) : 0n,
  };
}

async function saveState(state: IndexerState): Promise<void> {
  await supabase
    .from('indexer_state')
    .upsert({
      indexer_name: 'coinflip_events',
      last_processed_block: state.lastProcessedBlock.toString(),
      updated_at: new Date().toISOString(),
    });
}

// Process GameCreated event
async function processGameCreated(log: GameCreatedLog) {
  const { gameId, creator, tier, choice, amount } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`📝 GameCreated: ID=${gameId}, Creator=${creator}, Tier=${tier}`);

  const { error } = await supabase.from('games').upsert({
    id: gameId.toString(),
    tx_hash: txHash.toLowerCase(),
    tier: Number(tier),
    amount: amount.toString(),
    creator_address: creator.toLowerCase(),
    creator_choice: choice,
    status: 'pending',
    block_number: blockNumber.toString(),
    contract_address: CONTRACT_ADDRESS.toLowerCase(),
    contract_version: 4,
  }, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error('❌ Error upserting game:', error);
  }
}

// Process GameJoined event
async function processGameJoined(log: GameJoinedLog) {
  // Note: Contract's GameJoined event only has (gameId, joiner, totalPot) - NOT choice
  // The joiner's choice is always the opposite of the creator's choice (it's a heads vs tails game)
  const { gameId, joiner } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🤝 GameJoined: ID=${gameId}, Joiner=${joiner}`);

  try {
    // Fetch the game to get creator's choice and validate state
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('creator_choice, status')
      .eq('id', gameId.toString())
      .single();

    if (fetchError || !game) {
      console.error(`❌ Game ${gameId} not found for joining:`, fetchError);
      return;
    }

    // Idempotency check: skip if already processed
    if (game.status === 'matched' || game.status === 'resolved') {
      console.log(`⏭️ Game ${gameId} already matched/resolved, skipping`);
      return;
    }

    // Joiner always gets the opposite choice of creator
    const joinerChoice = !game.creator_choice;

    // Update game with retry - only if still in pending state (conditional update)
    await retryOperation(async () => {
      const { data, error } = await supabase
        .from('games')
        .update({
          joiner_address: joiner.toLowerCase(),
          joiner_choice: joinerChoice,
          status: 'matched',
          matched_tx_hash: txHash.toLowerCase(),
          matched_block_number: blockNumber.toString(),
          matched_at: new Date().toISOString(),
        })
        .eq('id', gameId.toString())
        .eq('status', 'pending') // Only update if still pending (idempotent)
        .select();

      if (error) throw error;

      // Check if update actually happened
      if (!data || data.length === 0) {
        console.log(`⏭️ Game ${gameId} was not in pending state, skipping update`);
      }
    });

    console.log(`✅ Game ${gameId} matched - joiner choice: ${joinerChoice ? 'tails' : 'heads'}`);
  } catch (error) {
    console.error(`❌ Error processing GameJoined for game ${gameId}:`, error);
    throw error;
  }
}

// Process GameResolved event
async function processGameResolved(log: GameResolvedLog) {
  const { gameId, winner, loser, coinResult, payout } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🎉 GameResolved: ID=${gameId}, Winner=${winner}, CoinResult=${coinResult}, Payout=${payout}`);

  try {
    // Fetch current game to validate
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId.toString())
      .single();

    if (fetchError || !game) {
      console.error(`❌ Game ${gameId} not found for resolution:`, fetchError);
      return;
    }

    // Idempotency check: skip if already resolved
    if (game.status === 'resolved') {
      console.log(`⏭️ Game ${gameId} already resolved, skipping`);
      return;
    }

    // Validate winner matches coin result (only if joiner_choice is set)
    if (game.joiner_choice !== null) {
      const winnerIsCreator = winner.toLowerCase() === game.creator_address.toLowerCase();
      const expectedChoice = coinResult; // Winner's choice should match coin result
      const actualWinnerChoice = winnerIsCreator ? game.creator_choice : game.joiner_choice;

      if (actualWinnerChoice !== expectedChoice) {
        console.error(`❌ CRITICAL: Winner choice mismatch for game ${gameId}!`, {
          winner: winner.toLowerCase(),
          coinResult,
          winnerIsCreator,
          actualWinnerChoice,
          expectedChoice,
        });
      }
    }

    // Calculate fee from actual payout (fee = totalPot - payout)
    // This works regardless of fee percentage since payout is after fee deduction
    const betAmount = BigInt(game.amount);
    const totalPot = betAmount * BigInt(2);
    const fee = totalPot - payout; // Actual fee taken by contract

    // Update game with retry - only if in matched state (conditional update)
    await retryOperation(async () => {
      const { data, error } = await supabase
        .from('games')
        .update({
          winner_address: winner.toLowerCase(),
          coin_result: coinResult,
          payout: payout.toString(),
          fee: fee.toString(),
          status: 'resolved',
          resolved_tx_hash: txHash.toLowerCase(),
          resolved_block_number: blockNumber.toString(),
          resolved_at: new Date().toISOString(),
        })
        .eq('id', gameId.toString())
        .eq('status', 'matched') // Only update if in matched state (idempotent)
        .select();

      if (error) throw error;

      // Check if update actually happened
      if (!data || data.length === 0) {
        console.log(`⏭️ Game ${gameId} was not in matched state, skipping update`);
      }
    });

    console.log(`✅ Game ${gameId} resolved successfully`);
  } catch (error) {
    console.error(`❌ Error processing GameResolved for game ${gameId}:`, error);
    throw error; // Re-throw to be caught by main indexer loop
  }
}

// Process GameCancelled event (manual cancel by creator)
async function processGameCancelled(log: GameCancelledLog) {
  const { gameId, creator } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`❌ GameCancelled: ID=${gameId}, Creator=${creator}`);

  // Conditional update - only if not already cancelled (idempotent)
  const { data, error } = await supabase
    .from('games')
    .update({
      status: 'cancelled',
      cancelled_tx_hash: txHash.toLowerCase(),
      cancelled_block_number: blockNumber.toString(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString())
    .neq('status', 'cancelled') // Only update if not already cancelled
    .select();

  if (error) {
    console.error('❌ Error updating game:', error);
  } else if (!data || data.length === 0) {
    console.log(`⏭️ Game ${gameId} already cancelled, skipping`);
  }
}

// Process GameAutoCancelled event (Chainlink Automation auto-cancel after 5 min)
async function processGameAutoCancelled(log: GameAutoCancelledLog) {
  const { gameId, creator } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🤖 GameAutoCancelled (Chainlink): ID=${gameId}, Creator=${creator}`);

  // Conditional update - only if not already cancelled (idempotent)
  const { data, error } = await supabase
    .from('games')
    .update({
      status: 'cancelled',
      cancelled_tx_hash: txHash.toLowerCase(),
      cancelled_block_number: blockNumber.toString(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString())
    .neq('status', 'cancelled')
    .select();

  if (error) {
    console.error('❌ Error updating game:', error);
  } else if (!data || data.length === 0) {
    console.log(`⏭️ Game ${gameId} already cancelled, skipping`);
  }
}

// Process VrfTimeoutClaimed event
// This occurs when a matched game's VRF request times out and players claim refund
async function processVrfTimeoutClaimed(log: VrfTimeoutClaimedLog) {
  const { gameId, playerA, playerB, refundAmount } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`⏰ VrfTimeoutClaimed: ID=${gameId}, PlayerA=${playerA}, PlayerB=${playerB}, Refund=${refundAmount}`);

  // Conditional update - only if not already cancelled (idempotent)
  const { data, error } = await supabase
    .from('games')
    .update({
      status: 'cancelled',
      cancelled_tx_hash: txHash.toLowerCase(),
      cancelled_block_number: blockNumber.toString(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString())
    .neq('status', 'cancelled')
    .select();

  if (error) {
    console.error('❌ Error updating game for VRF timeout:', error);
  } else if (!data || data.length === 0) {
    console.log(`⏭️ Game ${gameId} already cancelled, skipping`);
  }
}

// Process EmergencyRefund event
// This occurs when admin issues emergency refund for stuck games
async function processEmergencyRefund(log: EmergencyRefundLog) {
  const { gameId, playerA, playerB, totalRefund } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🚨 EmergencyRefund: ID=${gameId}, PlayerA=${playerA}, PlayerB=${playerB}, Refund=${totalRefund}`);

  // Conditional update - only if not already cancelled (idempotent)
  const { data, error } = await supabase
    .from('games')
    .update({
      status: 'cancelled',
      cancelled_tx_hash: txHash.toLowerCase(),
      cancelled_block_number: blockNumber.toString(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString())
    .neq('status', 'cancelled')
    .select();

  if (error) {
    console.error('❌ Error updating game for emergency refund:', error);
  } else if (!data || data.length === 0) {
    console.log(`⏭️ Game ${gameId} already cancelled, skipping`);
  }
}

// Main indexer function
async function indexEvents(fromBlock: bigint, toBlock: bigint) {
  const CHUNK_SIZE = 10n; // Alchemy free tier limit
  const CHUNK_DELAY = 500; // 500ms delay between chunks
  const totalBlocks = toBlock - fromBlock + 1n;

  console.log(`\n🔍 Indexing blocks ${fromBlock} to ${toBlock} (${totalBlocks} blocks)...`);

  let allCreatedLogs: GameCreatedLog[] = [];
  let allJoinedLogs: GameJoinedLog[] = [];
  let allResolvedLogs: GameResolvedLog[] = [];
  let allCancelledLogs: GameCancelledLog[] = [];
  let allAutoCancelledLogs: GameAutoCancelledLog[] = [];
  let allVrfTimeoutLogs: VrfTimeoutClaimedLog[] = [];
  let allEmergencyRefundLogs: EmergencyRefundLog[] = [];

  // Process in chunks to avoid rate limits
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;

    console.log(`  📦 Fetching blocks ${start} to ${end}...`);

    try {
      // Fetch all events in parallel for this chunk
      const [createdLogs, joinedLogs, resolvedLogs, cancelledLogs, autoCancelledLogs, vrfTimeoutLogs, emergencyRefundLogs] = await Promise.all([
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: GAME_CREATED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: GAME_MATCHED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: GAME_RESOLVED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: GAME_CANCELLED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: GAME_AUTO_CANCELLED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: VRF_TIMEOUT_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: EMERGENCY_REFUND_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
      ]);

      allCreatedLogs = [...allCreatedLogs, ...createdLogs as unknown as GameCreatedLog[]];
      allJoinedLogs = [...allJoinedLogs, ...joinedLogs as unknown as GameJoinedLog[]];
      allResolvedLogs = [...allResolvedLogs, ...resolvedLogs as unknown as GameResolvedLog[]];
      allCancelledLogs = [...allCancelledLogs, ...cancelledLogs as unknown as GameCancelledLog[]];
      allAutoCancelledLogs = [...allAutoCancelledLogs, ...autoCancelledLogs as unknown as GameAutoCancelledLog[]];
      allVrfTimeoutLogs = [...allVrfTimeoutLogs, ...vrfTimeoutLogs as unknown as VrfTimeoutClaimedLog[]];
      allEmergencyRefundLogs = [...allEmergencyRefundLogs, ...emergencyRefundLogs as unknown as EmergencyRefundLog[]];

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
    } catch (error: unknown) {
      // Handle rate limit errors
      const errObj = error as { status?: number; message?: string };
      if (errObj.status === 429 || errObj.message?.includes('rate limit')) {
        console.log('⏳ Rate limited! Waiting 10 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        start -= CHUNK_SIZE; // Retry this chunk
        continue;
      }
      throw error; // Re-throw other errors
    }
  }

  // Process events in chronological order
  const allLogs = [
    ...allCreatedLogs.map(log => ({ ...log, type: 'created' })),
    ...allJoinedLogs.map(log => ({ ...log, type: 'joined' })),
    ...allResolvedLogs.map(log => ({ ...log, type: 'resolved' })),
    ...allCancelledLogs.map(log => ({ ...log, type: 'cancelled' })),
    ...allAutoCancelledLogs.map(log => ({ ...log, type: 'auto_cancelled' })),
    ...allVrfTimeoutLogs.map(log => ({ ...log, type: 'vrf_timeout' })),
    ...allEmergencyRefundLogs.map(log => ({ ...log, type: 'emergency_refund' })),
  ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

  // Process each event
  for (const log of allLogs) {
    try {
      switch (log.type) {
        case 'created':
          await processGameCreated(log);
          break;
        case 'joined':
          await processGameJoined(log);
          break;
        case 'resolved':
          await processGameResolved(log);
          break;
        case 'cancelled':
          await processGameCancelled(log);
          break;
        case 'auto_cancelled':
          await processGameAutoCancelled(log);
          break;
        case 'vrf_timeout':
          await processVrfTimeoutClaimed(log);
          break;
        case 'emergency_refund':
          await processEmergencyRefund(log);
          break;
      }
    } catch (error) {
      console.error(`❌ Error processing ${log.type} event:`, error);
    }
  }

  console.log(`✅ Processed ${allLogs.length} events`);
}

// Watch contract events in real-time using WebSocket
function watchContractEvents(state: IndexerState) {
  console.log('⚡ Setting up real-time event watchers...');

  // Watch GameCreated events
  const unwatchCreated = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameCreated',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] GameCreated event received`);
        await processGameCreated(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ GameCreated watch error:', error),
  });

  // Watch GameJoined events
  const unwatchJoined = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameJoined',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] GameJoined event received`);
        await processGameJoined(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ GameJoined watch error:', error),
  });

  // Watch GameResolved events
  const unwatchResolved = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameResolved',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] GameResolved event received`);
        await processGameResolved(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ GameResolved watch error:', error),
  });

  // Watch GameCancelled events
  const unwatchCancelled = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameCancelled',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] GameCancelled event received`);
        await processGameCancelled(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ GameCancelled watch error:', error),
  });

  // Watch GameAutoCancelled events
  const unwatchAutoCancelled = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'GameAutoCancelled',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] GameAutoCancelled event received`);
        await processGameAutoCancelled(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ GameAutoCancelled watch error:', error),
  });

  // Watch VrfTimeoutClaimed events
  const unwatchVrfTimeout = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'VrfTimeoutClaimed',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] VrfTimeoutClaimed event received`);
        await processVrfTimeoutClaimed(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ VrfTimeoutClaimed watch error:', error),
  });

  // Watch EmergencyRefund events
  const unwatchEmergency = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: COINFLIP_ABI,
    eventName: 'EmergencyRefund',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`⚡ [LIVE] EmergencyRefund event received`);
        await processEmergencyRefund(log);
        if (log.blockNumber && log.blockNumber > state.lastProcessedBlock) {
          state.lastProcessedBlock = log.blockNumber;
          await saveState(state);
        }
      }
    },
    onError: (error) => console.error('❌ EmergencyRefund watch error:', error),
  });

  console.log('✅ Real-time event watchers active\n');

  // Return cleanup function
  return () => {
    unwatchCreated();
    unwatchJoined();
    unwatchResolved();
    unwatchCancelled();
    unwatchAutoCancelled();
    unwatchVrfTimeout();
    unwatchEmergency();
  };
}

// Fallback: Poll for new blocks (used when WebSocket not available)
function watchBlocksPolling(state: IndexerState) {
  console.log('📡 Using block polling (WebSocket not available)...');

  publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      if (blockNumber > state.lastProcessedBlock) {
        await indexEvents(state.lastProcessedBlock + 1n, blockNumber);
        state.lastProcessedBlock = blockNumber;
        await saveState(state);
      }
    },
    pollingInterval: 6_000, // 6 seconds for faster updates
  });
}

// Run indexer
async function main() {
  console.log('🚀 Starting CoinFlip Event Indexer...');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Sepolia`);

  // Get current block
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`📦 Current block: ${currentBlock}`);

  // Sync contract configuration on startup
  await syncContractConfig(currentBlock);

  // Load last processed block
  const state = await loadState();
  // Start from contract deployment block on first run to index all historical games
  // V4 contract deployed at 0xA8a83A6f13355CE4Da740d7894A7c91e48F20Dbe around block 9989650
  const DEPLOYMENT_BLOCK = 9989650n;
  const fromBlock = state.lastProcessedBlock === 0n ? DEPLOYMENT_BLOCK : state.lastProcessedBlock + 1n;

  console.log(`⏮️  Last processed block: ${state.lastProcessedBlock}`);
  console.log(`▶️  Starting from block: ${fromBlock}`);

  // Catch up on past events (always use getLogs for historical data)
  if (fromBlock < currentBlock) {
    await indexEvents(fromBlock, currentBlock);
    state.lastProcessedBlock = currentBlock;
    await saveState(state);
  }

  // Watch for new events
  console.log('\n👀 Watching for new events...\n');

  let cleanupWatchers: (() => void) | undefined;

  if (useWebSocket) {
    // Use real-time WebSocket event watching
    cleanupWatchers = watchContractEvents(state);
  } else {
    // Fallback to block polling
    watchBlocksPolling(state);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down indexer...');
    if (cleanupWatchers) {
      console.log('🧹 Cleaning up event watchers...');
      cleanupWatchers();
    }
    await saveState(state);
    console.log('✅ State saved. Goodbye!');
    process.exit(0);
  });
}

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
