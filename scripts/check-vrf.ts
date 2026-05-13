import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
});

const CONTRACT = '0x7cF8ae6Ce63aC845862beF4Ff2aEb3E774dC84CC' as const;
const VRF_COORDINATOR = '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B' as const;
const SUB_ID = BigInt('36534247073274299435646001531445000689090533189514176058290518552839108904477');

const VRF_ABI = parseAbi([
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
  'function pendingRequestExists(uint256 subId) view returns (bool)',
]);

const COINFLIP_ABI = parseAbi([
  'function nextGameId() view returns (uint256)',
  'function getGame(uint256 gameId) view returns (address playerA, address playerB, uint8 tier, bool choiceA, uint8 state, uint256 createdBlock, uint256 lockedBlock, uint256 vrfRequestId, bool coinResult, address winner)',
  'function vrfTimeoutBlocks() view returns (uint256)',
]);

async function main() {
  const [sub, pending, gameCounter, vrfTimeout, currentBlock] = await Promise.all([
    client.readContract({ address: VRF_COORDINATOR, abi: VRF_ABI, functionName: 'getSubscription', args: [SUB_ID] }),
    client.readContract({ address: VRF_COORDINATOR, abi: VRF_ABI, functionName: 'pendingRequestExists', args: [SUB_ID] }),
    client.readContract({ address: CONTRACT, abi: COINFLIP_ABI, functionName: 'nextGameId' }),
    client.readContract({ address: CONTRACT, abi: COINFLIP_ABI, functionName: 'vrfTimeoutBlocks' }),
    client.getBlockNumber(),
  ]);

  const [balance, , reqCount, , consumers] = sub as [bigint, bigint, bigint, string, string[]];
  console.log('\n=== VRF Subscription ===');
  console.log(`Balance:       ${(Number(balance) / 1e18).toFixed(4)} LINK`);
  console.log(`Total reqs:    ${reqCount}`);
  console.log(`Pending req:   ${pending}`);
  console.log(`Contract registered: ${(consumers as string[]).some(c => c.toLowerCase() === CONTRACT.toLowerCase())}`);
  console.log(`Consumers: ${(consumers as string[]).join(', ')}`);

  console.log('\n=== Contract State ===');
  console.log(`Current block: ${currentBlock}`);
  console.log(`VRF timeout:   ${vrfTimeout} blocks (~${Number(vrfTimeout) * 12 / 60} min)`);
  const totalGames = (gameCounter as bigint) - 1n;
  console.log(`Total games:   ${totalGames}`);

  console.log('\n=== Locked (awaiting VRF) Games ===');
  let lockedCount = 0;
  for (let i = 1n; i <= totalGames; i++) {
    const game = await client.readContract({ address: CONTRACT, abi: COINFLIP_ABI, functionName: 'getGame', args: [i] }) as unknown[];
    const state = Number(game[4]);
    if (state === 2) {
      const lockedBlock = game[5] as bigint;
      const blocksWaiting = currentBlock - lockedBlock;
      const canClaimTimeout = blocksWaiting >= (vrfTimeout as bigint);
      console.log(`  Game #${i}: locked at block ${lockedBlock}, waiting ${blocksWaiting} blocks${canClaimTimeout ? ' *** CAN CLAIM TIMEOUT ***' : ''}`);
      lockedCount++;
    }
  }
  if (lockedCount === 0) console.log('  None');
}

main().catch(console.error);
