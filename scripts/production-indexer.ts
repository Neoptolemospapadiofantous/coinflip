/**
 * Production-Ready Event Indexer for CoinFlip Contract
 *
 * Features:
 * - Environment validation
 * - Error handling and retry logic
 * - Health check endpoint
 * - Graceful shutdown
 * - Monitoring and metrics
 * - Rate limiting
 * - Dead letter queue for failed events
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { COINFLIP_ABI } from '../lib/contracts/abi';
import { validateIndexerEnv } from '../lib/env';
import * as http_server from 'http';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

// Validate environment
const ENV = validateIndexerEnv();

// Initialize clients with retry logic
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(ENV.SEPOLIA_RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 30_000,
  }),
});

const supabase = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

// Event signatures
const GAME_CREATED_EVENT = parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, bool choice, uint256 amount)');
const GAME_MATCHED_EVENT = parseAbiItem('event GameMatched(uint256 indexed gameId, address indexed joiner, bool choice)');
const GAME_RESOLVED_EVENT = parseAbiItem('event GameResolved(uint256 indexed gameId, address indexed winner, bool winnerChoice, uint256 randomNumber, uint256 payout)');
const GAME_CANCELLED_EVENT = parseAbiItem('event GameCancelled(uint256 indexed gameId, address indexed creator)');

// Configuration
const CONFIG = {
  CHUNK_SIZE: 10n, // Blocks per query (Alchemy free tier limit)
  INITIAL_LOOKBACK: 100n, // Blocks to index on first run
  POLL_INTERVAL: 12_000, // 12 seconds (Ethereum block time)
  RETRY_DELAY: 5_000, // 5 seconds
  MAX_RETRIES: 3,
  HEALTH_CHECK_PORT: 3001,
  CHUNK_DELAY: 100, // ms delay between chunks
};

// Metrics
const metrics = {
  totalEventsProcessed: 0,
  totalErrors: 0,
  lastBlockProcessed: 0n,
  lastSuccessfulSync: new Date(),
  startTime: new Date(),
};

// Failed events queue (for retry)
const failedEvents: Array<{ event: any; retries: number; error: string }> = [];

// Indexer state
interface IndexerState {
  lastProcessedBlock: bigint;
  isRunning: boolean;
  isPaused: boolean;
}

const state: IndexerState = {
  lastProcessedBlock: 0n,
  isRunning: false,
  isPaused: false,
};

/**
 * Load indexer state from database
 */
async function loadState(): Promise<bigint> {
  try {
    const { data, error } = await supabase
      .from('indexer_state')
      .select('last_processed_block')
      .eq('indexer_name', 'coinflip_events')
      .single();

    if (error && error.code !== 'PGRST116') { // Ignore "not found" error
      throw error;
    }

    const lastBlock = data?.last_processed_block ? BigInt(data.last_processed_block) : 0n;
    console.log(`⏮️  Loaded state: last processed block ${lastBlock}`);
    return lastBlock;
  } catch (error) {
    console.error('❌ Error loading state:', error);
    return 0n;
  }
}

/**
 * Save indexer state to database
 */
async function saveState(blockNumber: bigint): Promise<void> {
  try {
    const { error } = await supabase
      .from('indexer_state')
      .upsert({
        indexer_name: 'coinflip_events',
        last_processed_block: blockNumber.toString(),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    metrics.lastBlockProcessed = blockNumber;
    metrics.lastSuccessfulSync = new Date();
  } catch (error) {
    console.error('❌ Error saving state:', error);
    throw error;
  }
}

/**
 * Process event with retry logic
 */
async function processEventWithRetry(
  processor: () => Promise<void>,
  eventType: string,
  eventId: string,
  retries = 0
): Promise<void> {
  try {
    await processor();
    metrics.totalEventsProcessed++;
  } catch (error: any) {
    console.error(`❌ Error processing ${eventType} event ${eventId}:`, error.message);

    if (retries < CONFIG.MAX_RETRIES) {
      console.log(`🔄 Retrying... (${retries + 1}/${CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return processEventWithRetry(processor, eventType, eventId, retries + 1);
    } else {
      metrics.totalErrors++;
      failedEvents.push({
        event: { type: eventType, id: eventId },
        retries: CONFIG.MAX_RETRIES,
        error: error.message,
      });
      console.error(`💀 Failed after ${CONFIG.MAX_RETRIES} retries, added to dead letter queue`);
    }
  }
}

/**
 * Process GameCreated event
 */
async function processGameCreated(log: any): Promise<void> {
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

  if (error) throw error;
}

/**
 * Process GameMatched event
 */
async function processGameMatched(log: any): Promise<void> {
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

  if (error) throw error;
}

/**
 * Process GameResolved event
 */
async function processGameResolved(log: any): Promise<void> {
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

  if (error) throw error;
}

/**
 * Process GameCancelled event
 */
async function processGameCancelled(log: any): Promise<void> {
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

  if (error) throw error;
}

/**
 * Index events with chunking and rate limiting
 */
async function indexEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const totalBlocks = toBlock - fromBlock + 1n;

  if (totalBlocks <= 0) return;

  console.log(`\n🔍 Indexing blocks ${fromBlock} to ${toBlock} (${totalBlocks} blocks)...`);

  let allCreatedLogs: any[] = [];
  let allMatchedLogs: any[] = [];
  let allResolvedLogs: any[] = [];
  let allCancelledLogs: any[] = [];

  // Process in chunks
  for (let start = fromBlock; start <= toBlock; start += CONFIG.CHUNK_SIZE) {
    if (state.isPaused) {
      console.log('⏸️  Indexer paused, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    const end = start + CONFIG.CHUNK_SIZE - 1n > toBlock ? toBlock : start + CONFIG.CHUNK_SIZE - 1n;

    console.log(`  📦 Fetching blocks ${start} to ${end}...`);

    try {
      const [createdLogs, matchedLogs, resolvedLogs, cancelledLogs] = await Promise.all([
        publicClient.getLogs({
          address: ENV.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`,
          event: GAME_CREATED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: ENV.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`,
          event: GAME_MATCHED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: ENV.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`,
          event: GAME_RESOLVED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
        publicClient.getLogs({
          address: ENV.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`,
          event: GAME_CANCELLED_EVENT,
          fromBlock: start,
          toBlock: end,
        }),
      ]);

      allCreatedLogs = [...allCreatedLogs, ...createdLogs];
      allMatchedLogs = [...allMatchedLogs, ...matchedLogs];
      allResolvedLogs = [...allResolvedLogs, ...resolvedLogs];
      allCancelledLogs = [...allCancelledLogs, ...cancelledLogs];

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, CONFIG.CHUNK_DELAY));
    } catch (error: any) {
      console.error(`❌ Error fetching logs for blocks ${start}-${end}:`, error.message);

      // If RPC error, wait longer and retry
      if (error.message.includes('rate limit') || error.status === 429) {
        console.log('⏳ Rate limited, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10_000));
        start -= CONFIG.CHUNK_SIZE; // Retry this chunk
        continue;
      }

      throw error; // Re-throw other errors
    }
  }

  // Process all events in chronological order
  const allLogs = [
    ...allCreatedLogs.map(log => ({ ...log, type: 'created' })),
    ...allMatchedLogs.map(log => ({ ...log, type: 'matched' })),
    ...allResolvedLogs.map(log => ({ ...log, type: 'resolved' })),
    ...allCancelledLogs.map(log => ({ ...log, type: 'cancelled' })),
  ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

  // Process each event with retry logic
  for (const log of allLogs) {
    const eventId = log.args.gameId?.toString() || 'unknown';

    switch (log.type) {
      case 'created':
        await processEventWithRetry(() => processGameCreated(log), 'GameCreated', eventId);
        break;
      case 'matched':
        await processEventWithRetry(() => processGameMatched(log), 'GameMatched', eventId);
        break;
      case 'resolved':
        await processEventWithRetry(() => processGameResolved(log), 'GameResolved', eventId);
        break;
      case 'cancelled':
        await processEventWithRetry(() => processGameCancelled(log), 'GameCancelled', eventId);
        break;
    }
  }

  console.log(`✅ Processed ${allLogs.length} events`);
}

/**
 * Health check HTTP server
 */
function startHealthCheckServer(): void {
  const server = http_server.createServer((req, res) => {
    if (req.url === '/health') {
      const uptimeSeconds = (Date.now() - metrics.startTime.getTime()) / 1000;
      const secondsSinceLastSync = (Date.now() - metrics.lastSuccessfulSync.getTime()) / 1000;

      const health = {
        status: state.isRunning && secondsSinceLastSync < 60 ? 'healthy' : 'unhealthy',
        uptime: uptimeSeconds,
        lastBlock: metrics.lastBlockProcessed.toString(),
        eventsProcessed: metrics.totalEventsProcessed,
        errors: metrics.totalErrors,
        failedEvents: failedEvents.length,
        secondsSinceLastSync,
        isPaused: state.isPaused,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
    } else if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(
        `indexer_events_processed_total ${metrics.totalEventsProcessed}\n` +
        `indexer_errors_total ${metrics.totalErrors}\n` +
        `indexer_failed_events ${failedEvents.length}\n` +
        `indexer_last_block ${metrics.lastBlockProcessed}\n` +
        `indexer_uptime_seconds ${(Date.now() - metrics.startTime.getTime()) / 1000}\n`
      );
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(CONFIG.HEALTH_CHECK_PORT, () => {
    console.log(`🏥 Health check server running on http://localhost:${CONFIG.HEALTH_CHECK_PORT}/health`);
  });
}

/**
 * Main indexer loop
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Production CoinFlip Event Indexer...');
  console.log(`📍 Contract: ${ENV.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA}`);
  console.log(`🌐 Network: Sepolia (Chain ID: ${ENV.NEXT_PUBLIC_CHAIN_ID})`);
  console.log(`📡 RPC: ${ENV.SEPOLIA_RPC_URL.replace(/\/v2\/.*/, '/v2/***')}`);

  // Start health check server
  startHealthCheckServer();

  // Get current block
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`📦 Current block: ${currentBlock}`);

  // Load state
  state.lastProcessedBlock = await loadState();
  const fromBlock = state.lastProcessedBlock === 0n ? currentBlock - CONFIG.INITIAL_LOOKBACK : state.lastProcessedBlock + 1n;

  console.log(`▶️  Starting from block: ${fromBlock}`);

  // Catch up on past events
  if (fromBlock < currentBlock) {
    await indexEvents(fromBlock, currentBlock);
    await saveState(currentBlock);
    state.lastProcessedBlock = currentBlock;
  }

  // Watch for new events
  console.log('\n👀 Watching for new events...\n');
  state.isRunning = true;

  publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      if (state.isPaused) return;

      if (blockNumber > state.lastProcessedBlock) {
        try {
          await indexEvents(state.lastProcessedBlock + 1n, blockNumber);
          await saveState(blockNumber);
          state.lastProcessedBlock = blockNumber;
        } catch (error: any) {
          console.error('❌ Error in block watch:', error.message);
          metrics.totalErrors++;
        }
      }
    },
    pollingInterval: CONFIG.POLL_INTERVAL,
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);

  state.isRunning = false;
  state.isPaused = true;

  // Save current state
  if (state.lastProcessedBlock > 0n) {
    console.log('💾 Saving final state...');
    await saveState(state.lastProcessedBlock);
  }

  // Log final metrics
  console.log('\n📊 Final Metrics:');
  console.log(`  Events processed: ${metrics.totalEventsProcessed}`);
  console.log(`  Errors: ${metrics.totalErrors}`);
  console.log(`  Failed events: ${failedEvents.length}`);
  console.log(`  Last block: ${metrics.lastBlockProcessed}`);

  process.exit(0);
}

// Handle signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled rejection:', error);
  shutdown('UNHANDLED_REJECTION');
});

// Run
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
