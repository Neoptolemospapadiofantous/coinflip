/**
 * Sync Stale Games Script
 *
 * This script:
 * 1. Finds all games marked as 'pending' or 'matched' in the database
 * 2. Checks their actual state on the blockchain
 * 3. Updates the database to match the blockchain state
 *
 * Run with: npx tsx scripts/sync-stale-games.ts
 */

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COINFLIP_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'gameId', type: 'uint256' }],
    name: 'getGame',
    outputs: [
      { internalType: 'address', name: 'playerA', type: 'address' },
      { internalType: 'address', name: 'playerB', type: 'address' },
      { internalType: 'uint8', name: 'tier', type: 'uint8' },
      { internalType: 'bool', name: 'choiceA', type: 'bool' },
      { internalType: 'enum CoinFlip.GameState', name: 'state', type: 'uint8' },
      { internalType: 'uint256', name: 'createdBlock', type: 'uint256' },
      { internalType: 'address', name: 'winner', type: 'address' },
      { internalType: 'bool', name: 'coinResult', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Blockchain state enum
const BLOCKCHAIN_STATES: Record<number, string> = {
  0: 'none',      // NONE - doesn't exist
  1: 'pending',   // OPEN - waiting for player B
  2: 'matched',   // LOCKED - waiting for VRF
  3: 'resolved',  // RESOLVED - winner determined
  4: 'cancelled', // CANCELLED - refunded
};

async function main() {
  // Setup clients
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  console.log('🔍 Fetching active games from database...\n');

  // Get all games that should be active
  const { data: activeGames, error } = await supabase
    .from('games')
    .select('id, status, creator_address, created_at, block_number')
    .in('status', ['pending', 'matched'])
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    process.exit(1);
  }

  if (!activeGames || activeGames.length === 0) {
    console.log('✅ No active games found in database. Everything is synced!');
    return;
  }

  console.log(`Found ${activeGames.length} active game(s) in database:\n`);

  const updates: { id: number; dbStatus: string; chainStatus: string }[] = [];

  for (const game of activeGames) {
    try {
      const onChainGame = await publicClient.readContract({
        address: contractAddress,
        abi: COINFLIP_ABI,
        functionName: 'getGame',
        args: [BigInt(game.id)],
      });

      const chainState = BLOCKCHAIN_STATES[onChainGame[4]] || 'unknown';

      console.log(`Game ${game.id}:`);
      console.log(`  Database Status:   ${game.status}`);
      console.log(`  Blockchain Status: ${chainState}`);
      console.log(`  Created:           ${game.created_at}`);

      if (game.status !== chainState) {
        console.log(`  ⚠️  MISMATCH - needs update`);
        updates.push({ id: game.id, dbStatus: game.status, chainStatus: chainState });
      } else {
        console.log(`  ✅ Synced`);
      }
      console.log('');
    } catch (e: any) {
      console.error(`  ❌ Error reading game ${game.id}:`, e.message);
    }
  }

  // Apply updates
  if (updates.length > 0) {
    console.log('\n📝 Applying updates...\n');

    for (const update of updates) {
      if (update.chainStatus === 'none') {
        console.log(`Game ${update.id}: Skipping - game doesn't exist on chain`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update({ status: update.chainStatus })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Failed to update game ${update.id}:`, updateError.message);
      } else {
        console.log(`✅ Game ${update.id}: ${update.dbStatus} → ${update.chainStatus}`);
      }
    }

    console.log('\n🎉 Sync complete!');
  } else {
    console.log('✅ All games are already synced with blockchain!');
  }
}

main().catch(console.error);
