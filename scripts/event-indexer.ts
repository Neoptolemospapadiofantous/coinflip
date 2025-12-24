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
import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { COINFLIP_ABI } from '../lib/contracts/abi';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA! as `0x${string}`;
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';

// Initialize clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Event signatures
const GAME_CREATED_EVENT = parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, bool choice, uint256 amount)');
const GAME_MATCHED_EVENT = parseAbiItem('event GameMatched(uint256 indexed gameId, address indexed joiner, bool choice)');
const GAME_RESOLVED_EVENT = parseAbiItem('event GameResolved(uint256 indexed gameId, address indexed winner, bool winnerChoice, uint256 randomNumber, uint256 payout)');
const GAME_CANCELLED_EVENT = parseAbiItem('event GameCancelled(uint256 indexed gameId, address indexed creator)');

interface IndexerState {
  lastProcessedBlock: bigint;
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
async function processGameCreated(log: any) {
  const { gameId, creator, tier, choice, amount } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`📝 GameCreated: ID=${gameId}, Creator=${creator}, Tier=${tier}`);

  const { error } = await supabase.from('games').insert({
    id: gameId.toString(),
    tx_hash: txHash,
    tier: Number(tier),
    amount: amount.toString(),
    creator_address: creator.toLowerCase(),
    creator_choice: choice,
    status: 'pending',
    block_number: blockNumber.toString(),
  });

  if (error) {
    console.error('❌ Error inserting game:', error);
  }
}

// Process GameMatched event
async function processGameMatched(log: any) {
  const { gameId, joiner, choice } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🤝 GameMatched: ID=${gameId}, Joiner=${joiner}`);

  const { error } = await supabase
    .from('games')
    .update({
      joiner_address: joiner.toLowerCase(),
      joiner_choice: choice,
      status: 'matched',
      matched_tx_hash: txHash,
      matched_block_number: blockNumber.toString(),
      matched_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString());

  if (error) {
    console.error('❌ Error updating game:', error);
  }
}

// Process GameResolved event
async function processGameResolved(log: any) {
  const { gameId, winner, winnerChoice, randomNumber, payout } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`🎉 GameResolved: ID=${gameId}, Winner=${winner}, Payout=${payout}`);

  const { error } = await supabase
    .from('games')
    .update({
      winner_address: winner.toLowerCase(),
      random_number: randomNumber.toString(),
      payout: payout.toString(),
      status: 'resolved',
      resolved_tx_hash: txHash,
      resolved_block_number: blockNumber.toString(),
      resolved_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString());

  if (error) {
    console.error('❌ Error updating game:', error);
  }
}

// Process GameCancelled event
async function processGameCancelled(log: any) {
  const { gameId, creator } = log.args;
  const blockNumber = log.blockNumber;
  const txHash = log.transactionHash;

  console.log(`❌ GameCancelled: ID=${gameId}, Creator=${creator}`);

  const { error } = await supabase
    .from('games')
    .update({
      status: 'cancelled',
      cancelled_tx_hash: txHash,
      cancelled_block_number: blockNumber.toString(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', gameId.toString());

  if (error) {
    console.error('❌ Error updating game:', error);
  }
}

// Main indexer function
async function indexEvents(fromBlock: bigint, toBlock: bigint) {
  const CHUNK_SIZE = 10n; // Alchemy free tier limit
  const totalBlocks = toBlock - fromBlock + 1n;

  console.log(`\n🔍 Indexing blocks ${fromBlock} to ${toBlock} (${totalBlocks} blocks)...`);

  let allCreatedLogs: any[] = [];
  let allMatchedLogs: any[] = [];
  let allResolvedLogs: any[] = [];
  let allCancelledLogs: any[] = [];

  // Process in chunks to avoid rate limits
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;

    console.log(`  📦 Fetching blocks ${start} to ${end}...`);

    // Fetch all events in parallel for this chunk
    const [createdLogs, matchedLogs, resolvedLogs, cancelledLogs] = await Promise.all([
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
    ]);

    allCreatedLogs = [...allCreatedLogs, ...createdLogs];
    allMatchedLogs = [...allMatchedLogs, ...matchedLogs];
    allResolvedLogs = [...allResolvedLogs, ...resolvedLogs];
    allCancelledLogs = [...allCancelledLogs, ...cancelledLogs];

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Process events in chronological order
  const allLogs = [
    ...allCreatedLogs.map(log => ({ ...log, type: 'created' })),
    ...allMatchedLogs.map(log => ({ ...log, type: 'matched' })),
    ...allResolvedLogs.map(log => ({ ...log, type: 'resolved' })),
    ...allCancelledLogs.map(log => ({ ...log, type: 'cancelled' })),
  ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

  // Process each event
  for (const log of allLogs) {
    try {
      switch (log.type) {
        case 'created':
          await processGameCreated(log);
          break;
        case 'matched':
          await processGameMatched(log);
          break;
        case 'resolved':
          await processGameResolved(log);
          break;
        case 'cancelled':
          await processGameCancelled(log);
          break;
      }
    } catch (error) {
      console.error(`❌ Error processing ${log.type} event:`, error);
    }
  }

  console.log(`✅ Processed ${allLogs.length} events`);
}

// Run indexer
async function main() {
  console.log('🚀 Starting CoinFlip Event Indexer...');
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Sepolia`);

  // Get current block
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`📦 Current block: ${currentBlock}`);

  // Load last processed block
  const state = await loadState();
  // Start from 100 blocks ago on first run (to avoid long initial sync)
  const fromBlock = state.lastProcessedBlock === 0n ? currentBlock - 100n : state.lastProcessedBlock + 1n;

  console.log(`⏮️  Last processed block: ${state.lastProcessedBlock}`);
  console.log(`▶️  Starting from block: ${fromBlock}`);

  // Catch up on past events
  if (fromBlock < currentBlock) {
    await indexEvents(fromBlock, currentBlock);
    state.lastProcessedBlock = currentBlock;
    await saveState(state);
  }

  // Watch for new events
  console.log('\n👀 Watching for new events...\n');

  publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      if (blockNumber > state.lastProcessedBlock) {
        await indexEvents(state.lastProcessedBlock + 1n, blockNumber);
        state.lastProcessedBlock = blockNumber;
        await saveState(state);
      }
    },
    pollingInterval: 12_000, // 12 seconds (Ethereum block time)
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down indexer...');
  process.exit(0);
});

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
