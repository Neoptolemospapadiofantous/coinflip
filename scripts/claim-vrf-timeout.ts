/**
 * Waits until a game's VRF timeout is claimable, then claims the refund.
 * Usage: GAME_ID=2 npx tsx --env-file=.env.local scripts/claim-vrf-timeout.ts
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/chains';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount as pta } from 'viem/accounts';

const CONTRACT = '0x7cF8ae6Ce63aC845862beF4Ff2aEb3E774dC84CC' as const;
const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const GAME_ID = BigInt(process.env.GAME_ID || '2');

const ABI = parseAbi([
  'function getGame(uint256 gameId) view returns (address playerA, address playerB, uint8 tier, bool choiceA, uint8 state, uint256 createdBlock, uint256 lockedBlock, uint256 vrfRequestId, bool coinResult, address winner)',
  'function canClaimVrfTimeout(uint256 gameId) view returns (bool)',
  'function claimVrfTimeout(uint256 gameId)',
  'function vrfTimeoutBlocks() view returns (uint256)',
  'function getTier(uint8 tierId) view returns (uint256 amount, bool enabled, uint256 totalGames, uint256 totalVolume)',
]);

const STATE = ['NONE', 'OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED'];

const claimer = pta(process.env.BOT_1_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account: claimer, chain: sepolia, transport: http(RPC) });

const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);

async function main() {
  log(`Monitoring game #${GAME_ID} for VRF timeout claim...`);

  const vrfTimeout = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'vrfTimeoutBlocks' }) as bigint;

  while (true) {
    const [gameRaw, canClaim, currentBlock] = await Promise.all([
      publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'getGame', args: [GAME_ID] }) as Promise<unknown[]>,
      publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'canClaimVrfTimeout', args: [GAME_ID] }) as Promise<boolean>,
      publicClient.getBlockNumber(),
    ]);

    const state = Number((gameRaw as unknown[])[4]);
    const lockedBlock = (gameRaw as unknown[])[6] as bigint;
    const blocksWaited = currentBlock - lockedBlock;
    const blocksLeft = vrfTimeout - blocksWaited;

    if (state === 3) {
      log(`✅ Game RESOLVED by VRF! Winner: ${(gameRaw as unknown[])[9]}`);
      return;
    }

    if (state === 4) {
      log(`Game already CANCELLED`);
      return;
    }

    log(`block ${currentBlock} | state=${STATE[state]} | waited ${blocksWaited}/${vrfTimeout} blocks | canClaim=${canClaim}${blocksLeft > 0n ? ` | ~${blocksLeft * 12n / 60n}min left` : ''}`);

    if (canClaim) {
      log(`\n── Claiming VRF timeout for game #${GAME_ID} ──`);
      const tier = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'getTier', args: [Number((gameRaw as unknown[])[2])] }) as [bigint, boolean, bigint, bigint];
      const hash = await walletClient.writeContract({ address: CONTRACT, abi: ABI, functionName: 'claimVrfTimeout', args: [GAME_ID] });
      log(`tx: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      log(`confirmed in block ${receipt.blockNumber}`);
      log(`\n✅ VRF TIMEOUT CLAIMED — both players refunded ${formatEther(tier[0])} ETH each`);
      log(`   PlayerA (BOT_1): ${(gameRaw as unknown[])[0]}`);
      log(`   PlayerB (BOT_2): ${(gameRaw as unknown[])[1]}`);
      return;
    }

    await new Promise(r => setTimeout(r, 12000));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
