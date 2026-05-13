/**
 * Polls the Chainlink AutomationRegistry until the forwarder is assigned,
 * then calls setAutomationForwarder on the CoinFlip contract.
 *
 * Run: npx tsx scripts/set-forwarder.ts
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const RPC      = `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const CONTRACT = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`;
const REGISTRY = '0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad' as `0x${string}`;
const UPKEEP_ID = BigInt(process.env.AUTOMATION_UPKEEP_ID || '0');

const REGISTRY_ABI = [
  { name: 'getForwarder', type: 'function', stateMutability: 'view', inputs: [{ name: 'upkeepID', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
] as const;

const COINFLIP_ABI = [
  { name: 'setAutomationForwarder', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newForwarder', type: 'address' }], outputs: [] },
  { name: 'automationForwarder',    type: 'function', stateMutability: 'view',       inputs: [],                                           outputs: [{ type: 'address' }] },
] as const;

async function main() {
  if (UPKEEP_ID === 0n) { console.error('AUTOMATION_UPKEEP_ID not set in .env.local'); process.exit(1); }

  const ownerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account: ownerAccount, chain: sepolia, transport: http(RPC) });

  console.log(`Polling for forwarder assignment on upkeep ${UPKEEP_ID}...`);

  for (let attempt = 1; attempt <= 40; attempt++) {
    const forwarder = await publicClient.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getForwarder', args: [UPKEEP_ID] });

    if (forwarder !== '0x0000000000000000000000000000000000000000') {
      console.log(`\nForwarder assigned: ${forwarder}`);

      const tx = await walletClient.writeContract({ address: CONTRACT, abi: COINFLIP_ABI, functionName: 'setAutomationForwarder', args: [forwarder] });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`setAutomationForwarder done. tx: ${tx}`);

      const stored = await publicClient.readContract({ address: CONTRACT, abi: COINFLIP_ABI, functionName: 'automationForwarder' });
      console.log(`Confirmed on contract: ${stored}`);

      // Patch .env.local
      let env = fs.readFileSync('.env.local', 'utf-8');
      env = env.replace(/# AUTOMATION_FORWARDER_ADDRESS=.*/, `AUTOMATION_FORWARDER_ADDRESS=${forwarder}`);
      fs.writeFileSync('.env.local', env);
      console.log('.env.local updated with AUTOMATION_FORWARDER_ADDRESS');
      return;
    }

    process.stdout.write(`  attempt ${attempt}/40 — not yet assigned, waiting 15s...\r`);
    await new Promise(r => setTimeout(r, 15_000));
  }

  console.log('\nForwarder still not assigned after 10 minutes.');
  console.log('Check https://automation.chain.link/sepolia for your upkeep status.');
  console.log('Then add AUTOMATION_FORWARDER_ADDRESS=<address> to .env.local and re-run.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
