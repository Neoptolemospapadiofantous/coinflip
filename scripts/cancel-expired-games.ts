/**
 * Cancel Expired Games Script
 *
 * This script manually cancels games that are past their timeout period.
 * Use this when Chainlink Automation isn't running or has run out of LINK.
 *
 * Run with: npx tsx scripts/cancel-expired-games.ts
 *
 * Options:
 *   --dry-run    Show what would be cancelled without actually doing it
 *   --game-id=X  Cancel a specific game ID
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
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
  {
    inputs: [{ internalType: 'uint256', name: 'gameId', type: 'uint256' }],
    name: 'cancelGame',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'timeoutBlocks',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getOpenGameIds',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const specificGameId = args.find(a => a.startsWith('--game-id='))?.split('=')[1];

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const contractAddress = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`;

  if (!privateKey) {
    console.error('Missing PRIVATE_KEY in .env.local');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  console.log(`🔑 Using wallet: ${account.address}`);
  console.log(`📜 Contract: ${contractAddress}`);
  console.log(`${dryRun ? '🔍 DRY RUN MODE' : '⚡ LIVE MODE'}\n`);

  // Get current block and timeout setting
  const [currentBlock, timeoutBlocks] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.readContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'timeoutBlocks',
    }),
  ]);

  console.log(`Current block: ${currentBlock}`);
  console.log(`Timeout blocks: ${timeoutBlocks}\n`);

  // Get open games
  let openGameIds: readonly bigint[];
  try {
    openGameIds = await publicClient.readContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'getOpenGameIds',
    });
  } catch (e) {
    console.log('Note: getOpenGameIds not available, checking specific game(s)');
    openGameIds = specificGameId ? [BigInt(specificGameId)] : [0n, 1n, 2n, 3n, 4n];
  }

  if (specificGameId) {
    openGameIds = [BigInt(specificGameId)];
  }

  console.log(`Checking ${openGameIds.length} game(s)...\n`);

  const expiredGames: { id: bigint; creator: string; blockAge: bigint }[] = [];

  for (const gameId of openGameIds) {
    try {
      const game = await publicClient.readContract({
        address: contractAddress,
        abi: COINFLIP_ABI,
        functionName: 'getGame',
        args: [gameId],
      });

      const state = game[4];
      const createdBlock = game[5];
      const creator = game[0];

      // State 1 = OPEN (pending)
      if (state === 1) {
        const blockAge = currentBlock - createdBlock;
        const isExpired = blockAge >= timeoutBlocks;

        console.log(`Game ${gameId}:`);
        console.log(`  Creator: ${creator}`);
        console.log(`  Created: block ${createdBlock} (${blockAge} blocks ago)`);
        console.log(`  Expired: ${isExpired ? '✅ YES' : '❌ No'}`);

        if (isExpired) {
          expiredGames.push({ id: gameId, creator, blockAge });
        }
        console.log('');
      }
    } catch (e: any) {
      // Game doesn't exist or error reading
    }
  }

  if (expiredGames.length === 0) {
    console.log('✅ No expired games found!');
    return;
  }

  console.log(`\n📋 Found ${expiredGames.length} expired game(s) to cancel:\n`);

  for (const game of expiredGames) {
    console.log(`Game ${game.id}: ${game.blockAge} blocks old (creator: ${game.creator.slice(0, 10)}...)`);
  }

  if (dryRun) {
    console.log('\n🔍 Dry run complete. Remove --dry-run to actually cancel games.');
    return;
  }

  console.log('\n⚡ Cancelling games...\n');

  for (const game of expiredGames) {
    try {
      console.log(`Cancelling game ${game.id}...`);

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: COINFLIP_ABI,
        functionName: 'cancelGame',
        args: [game.id],
      });

      console.log(`  TX: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Status: ${receipt.status === 'success' ? '✅ Success' : '❌ Failed'}`);
      console.log('');
    } catch (e: any) {
      console.error(`  ❌ Error: ${e.message}`);
    }
  }

  console.log('🎉 Done!');
}

main().catch(console.error);
