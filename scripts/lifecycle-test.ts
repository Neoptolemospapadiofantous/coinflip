/**
 * Full lifecycle test: create → join → VRF → resolved
 *
 * Uses BOT_1 as creator and BOT_2 as joiner.
 * Polls every 12s until the game resolves or VRF timeout is claimable.
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const CONTRACT = '0x7cF8ae6Ce63aC845862beF4Ff2aEb3E774dC84CC' as const;
const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

const ABI = parseAbi([
  'function createGame(uint8 tier, bool choice) payable returns (uint256 gameId)',
  'function joinGame(uint256 gameId) payable',
  'function cancelGame(uint256 gameId)',
  'function claimVrfTimeout(uint256 gameId)',
  'function getGame(uint256 gameId) view returns (address playerA, address playerB, uint8 tier, bool choiceA, uint8 state, uint256 createdBlock, uint256 lockedBlock, uint256 vrfRequestId, bool coinResult, address winner)',
  'function getTier(uint8 tierId) view returns (uint256 amount, bool enabled, uint256 totalGames, uint256 totalVolume)',
  'function nextGameId() view returns (uint256)',
  'function vrfTimeoutBlocks() view returns (uint256)',
  'function canClaimVrfTimeout(uint256 gameId) view returns (bool)',
]);

const STATE = ['NONE', 'OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED'];

const creator = privateKeyToAccount(process.env.BOT_1_PRIVATE_KEY as `0x${string}`);
const joiner  = privateKeyToAccount(process.env.BOT_2_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

const creatorWallet = createWalletClient({ account: creator, chain: sepolia, transport: http(RPC) });
const joinerWallet  = createWalletClient({ account: joiner,  chain: sepolia, transport: http(RPC) });

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);

async function getGame(gameId: bigint) {
  const g = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'getGame', args: [gameId] }) as [string, string, number, boolean, number, bigint, bigint, bigint, boolean, string];
  return {
    playerA: g[0], playerB: g[1], tier: g[2], choiceA: g[3],
    state: g[4], createdBlock: g[5], lockedBlock: g[6],
    vrfRequestId: g[7], coinResult: g[8], winner: g[9],
  };
}

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // ─── Check balances ───────────────────────────────────────────────────────
  const [balA, balB] = await Promise.all([
    publicClient.getBalance({ address: creator.address }),
    publicClient.getBalance({ address: joiner.address }),
  ]);
  log(`BOT_1 (creator): ${creator.address}  balance: ${formatEther(balA)} ETH`);
  log(`BOT_2 (joiner):  ${joiner.address}  balance: ${formatEther(balB)} ETH`);

  // ─── Pick tier 0 (smallest bet) ──────────────────────────────────────────
  const TIER = 0;
  const tier = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'getTier', args: [TIER] }) as [bigint, boolean, bigint, bigint];
  const amount = tier[0];
  const enabled = tier[1];
  if (!enabled || amount === 0n) {
    console.error(`Tier ${TIER} is disabled or has zero amount — set it up first`);
    process.exit(1);
  }
  log(`Tier ${TIER}: ${formatEther(amount)} ETH per player`);

  if (balA < amount * 2n) { console.error('BOT_1 balance too low'); process.exit(1); }
  if (balB < amount * 2n) { console.error('BOT_2 balance too low'); process.exit(1); }

  // ─── 1. Create game ──────────────────────────────────────────────────────
  log('\n── STEP 1: Create game (BOT_1 picks HEADS) ──');
  const createHash = await creatorWallet.writeContract({
    address: CONTRACT, abi: ABI, functionName: 'createGame',
    args: [TIER, true], // true = heads
    value: amount,
  });
  log(`  tx: ${createHash}`);
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  log(`  confirmed in block ${createReceipt.blockNumber}`);

  const nextId = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextGameId' }) as bigint;
  const gameId = nextId - 1n;
  log(`  game ID: ${gameId}`);

  const gameAfterCreate = await getGame(gameId);
  log(`  state: ${STATE[gameAfterCreate.state]} (expected OPEN)`);

  // ─── 2. Join game ─────────────────────────────────────────────────────────
  log('\n── STEP 2: Join game (BOT_2 picks TAILS) ──');
  const joinHash = await joinerWallet.writeContract({
    address: CONTRACT, abi: ABI, functionName: 'joinGame',
    args: [gameId],
    value: amount,
  });
  log(`  tx: ${joinHash}`);
  const joinReceipt = await publicClient.waitForTransactionReceipt({ hash: joinHash });
  log(`  confirmed in block ${joinReceipt.blockNumber}`);

  const gameAfterJoin = await getGame(gameId);
  log(`  state: ${STATE[gameAfterJoin.state]} (expected LOCKED)`);
  log(`  VRF request ID: ${gameAfterJoin.vrfRequestId}`);

  if (gameAfterJoin.state !== 2) {
    console.error('Game did not enter LOCKED state after join — something went wrong');
    process.exit(1);
  }

  // ─── 3. Poll for VRF resolution ───────────────────────────────────────────
  log('\n── STEP 3: Waiting for Chainlink VRF... ──');
  const vrfTimeout = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'vrfTimeoutBlocks' }) as bigint;
  const lockedBlock = gameAfterJoin.lockedBlock;
  const timeoutBlock = lockedBlock + vrfTimeout;
  log(`  VRF must respond by block ${timeoutBlock} (${vrfTimeout} blocks from lock)`);

  let attempts = 0;
  const MAX_POLLS = 120; // 120 × 12s = 24 min

  while (attempts < MAX_POLLS) {
    await wait(12000);
    attempts++;

    const game = await getGame(gameId);
    const currentBlock = await publicClient.getBlockNumber();
    const blocksWaited = currentBlock - lockedBlock;
    const pct = Math.round(Number(blocksWaited * 100n / vrfTimeout));

    if (game.state === 3) { // RESOLVED
      log(`\n✅ RESOLVED after ${blocksWaited} blocks (~${Math.round(Number(blocksWaited) * 12 / 60)} min)`);
      log(`   Coin result : ${game.coinResult ? 'HEADS' : 'TAILS'}`);
      log(`   Winner      : ${game.winner}`);
      const winnerLabel = game.winner.toLowerCase() === creator.address.toLowerCase() ? 'BOT_1 (creator)' : game.winner.toLowerCase() === joiner.address.toLowerCase() ? 'BOT_2 (joiner)' : 'unknown';
      log(`   Winner is   : ${winnerLabel}`);
      log(`   Payout      : ${formatEther(amount * 2n * 97n / 100n)} ETH (after 3% fee)`);
      return;
    }

    if (game.state === 4) { // CANCELLED
      log(`\n⚠️  Game was CANCELLED`);
      return;
    }

    // Check if VRF timeout claimable
    const canClaim = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'canClaimVrfTimeout', args: [gameId] }) as boolean;
    log(`  block ${currentBlock} (+${blocksWaited}/${vrfTimeout}, ${pct}%) state=${STATE[game.state]}${canClaim ? ' — VRF TIMEOUT CLAIMABLE' : ''}`);

    if (canClaim) {
      log('\n── STEP 4: Claiming VRF timeout (refund both players) ──');
      const timeoutHash = await creatorWallet.writeContract({
        address: CONTRACT, abi: ABI, functionName: 'claimVrfTimeout', args: [gameId],
      });
      log(`  tx: ${timeoutHash}`);
      const timeoutReceipt = await publicClient.waitForTransactionReceipt({ hash: timeoutHash });
      log(`  confirmed in block ${timeoutReceipt.blockNumber}`);
      log(`\n⚠️  VRF timed out — both players refunded ${formatEther(amount)} ETH each`);
      return;
    }
  }

  log(`\n⏱  Poll limit reached (${MAX_POLLS * 12 / 60} min). Game still ${STATE[(await getGame(gameId)).state]}. Check again later.`);
}

main().catch(err => { console.error(err); process.exit(1); });
