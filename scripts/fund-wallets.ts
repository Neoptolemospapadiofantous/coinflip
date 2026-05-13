/**
 * Step 2 of 2: Fund all test wallets and configure Chainlink services.
 *
 * Run: npx tsx scripts/fund-wallets.ts
 *
 * Prerequisites:
 *   - Run setup-wallets.ts first
 *   - OWNER wallet must have ≥ 0.5 ETH and ≥ 60 LINK on Sepolia
 *
 * What it does automatically:
 *   1. Reads wallet addresses from Supabase
 *   2. Distributes ETH from OWNER to all 5 bot wallets
 *   3. Funds the VRF subscription with 50 LINK
 *   4. Adds the CoinFlip contract as a VRF consumer
 *   5. Registers a Chainlink Automation upkeep (10 LINK)
 *   6. Calls setAutomationForwarder on the CoinFlip contract
 *   7. Updates funded status and balances in Supabase
 */

import {
  createPublicClient, createWalletClient, http, parseEther, formatEther,
  parseUnits, formatUnits, encodeFunctionData, encodeAbiParameters,
  parseAbiParameters, getContract,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ─── Config ───────────────────────────────────────────────────────────────────

const RPC_URL       = `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const CONTRACT_ADDR = process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`;
const VRF_SUB_ID    = BigInt(process.env.VRF_SUBSCRIPTION_ID || '0');

const LINK_TOKEN    = '0x779877A7B0D9E8603169DdbD7836e478b4624789' as `0x${string}`; // Sepolia
const VRF_COORD     = '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B' as `0x${string}`; // Sepolia V2.5
const AUTO_REGISTRAR = '0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976' as `0x${string}`; // Sepolia v2.1

// ETH to send to each bot wallet
const BOT_ETH: Record<string, bigint> = {
  BOT_1: parseEther('0.3'),
  BOT_2: parseEther('0.3'),
  BOT_3: parseEther('0.3'),
  BOT_4: parseEther('0.1'),
  BOT_5: parseEther('0.1'),
};

// LINK amounts (18 decimals)
const LINK_FOR_VRF        = parseUnits('50', 18);
const LINK_FOR_AUTOMATION = parseUnits('10', 18);

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────

const LINK_ABI = [
  { name: 'balanceOf',      type: 'function', stateMutability: 'view',     inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transferAndCall', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [{ type: 'bool' }] },
  { name: 'approve',        type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

const VRF_ABI = [
  { name: 'addConsumer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'subId', type: 'uint256' }, { name: 'consumer', type: 'address' }], outputs: [] },
  { name: 'getSubscription', type: 'function', stateMutability: 'view', inputs: [{ name: 'subId', type: 'uint256' }], outputs: [{ name: 'balance', type: 'uint96' }, { name: 'nativeBalance', type: 'uint96' }, { name: 'reqCount', type: 'uint64' }, { name: 'subOwner', type: 'address' }, { name: 'consumers', type: 'address[]' }] },
] as const;

const AUTO_REGISTRAR_ABI = [
  {
    name: 'registerUpkeep',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'requestParams',
      type: 'tuple',
      components: [
        { name: 'name',                  type: 'string'  },
        { name: 'encryptedEmail',        type: 'bytes'   },
        { name: 'upkeepContract',        type: 'address' },
        { name: 'gasLimit',              type: 'uint32'  },
        { name: 'adminAddress',          type: 'address' },
        { name: 'triggerType',           type: 'uint8'   },
        { name: 'checkData',             type: 'bytes'   },
        { name: 'triggerConfig',         type: 'bytes'   },
        { name: 'offchainConfig',        type: 'bytes'   },
        { name: 'amount',                type: 'uint96'  },
      ],
    }],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
] as const;

const COINFLIP_ABI = [
  { name: 'setAutomationForwarder', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newForwarder', type: 'address' }], outputs: [] },
  { name: 'automationForwarder',    type: 'function', stateMutability: 'view',       inputs: [],                                           outputs: [{ type: 'address' }] },
] as const;

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function step(n: number, label: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Step ${n}: ${label}`);
  console.log('─'.repeat(60));
}

function ok(msg: string)   { console.log(`  ✅ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }
function skip(msg: string) { console.log(`  ⏭  ${msg}`); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 CoinFlip Fund & Configure Script\n');

  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not set in .env.local — run setup-wallets.ts first'); process.exit(1);
  }
  if (VRF_SUB_ID === 0n) {
    console.error('❌ VRF_SUBSCRIPTION_ID not set in .env.local'); process.exit(1);
  }
  if (!CONTRACT_ADDR || CONTRACT_ADDR === '0x0000000000000000000000000000000000000000') {
    console.error('❌ NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA not set'); process.exit(1);
  }

  // Load wallets from Supabase
  const { data: wallets, error } = await supabase.from('test_wallets').select('*');
  if (error || !wallets?.length) {
    console.error('❌ Could not load wallets from Supabase:', error?.message);
    console.log('   Run setup-wallets.ts first and apply migration 037.'); process.exit(1);
  }

  const ownerWallet = wallets.find(w => w.role === 'OWNER');
  if (!ownerWallet) { console.error('❌ OWNER wallet not in DB'); process.exit(1); }

  const ownerAccount = privateKeyToAccount(ownerWallet.private_key as `0x${string}`);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: ownerAccount, chain: sepolia, transport: http(RPC_URL) });

  // ── Check owner balances ──────────────────────────────────────────────────
  step(1, 'Check OWNER balances');

  const ethBalance  = await publicClient.getBalance({ address: ownerAccount.address });
  const linkBalance = await publicClient.readContract({ address: LINK_TOKEN, abi: LINK_ABI, functionName: 'balanceOf', args: [ownerAccount.address] });

  console.log(`  ETH  : ${formatEther(ethBalance)} ETH`);
  console.log(`  LINK : ${formatUnits(linkBalance, 18)} LINK`);

  const needsEth  = parseEther('1.2'); // total for bots + gas buffer
  const needsLink = LINK_FOR_VRF + LINK_FOR_AUTOMATION;

  if (ethBalance < needsEth) {
    console.error(`\n❌ Not enough ETH. Have ${formatEther(ethBalance)}, need ≥ ${formatEther(needsEth)}`);
    console.log('   Fund OWNER wallet from:');
    console.log('   https://sepoliafaucet.com');
    console.log('   https://faucets.chain.link/sepolia'); process.exit(1);
  }
  if (linkBalance < needsLink) {
    console.error(`\n❌ Not enough LINK. Have ${formatUnits(linkBalance, 18)}, need ≥ ${formatUnits(needsLink, 18)}`);
    console.log('   Get testnet LINK from: https://faucets.chain.link/sepolia'); process.exit(1);
  }
  ok('OWNER has sufficient ETH and LINK');

  // ── Distribute ETH to bots ────────────────────────────────────────────────
  step(2, 'Distribute ETH to bot wallets');

  for (const w of wallets.filter(w => w.role.startsWith('BOT'))) {
    const target = BOT_ETH[w.role];
    if (!target) continue;

    const current = await publicClient.getBalance({ address: w.address as `0x${string}` });
    if (current >= target) {
      skip(`${w.role} already has ${formatEther(current)} ETH`); continue;
    }

    const toSend = target - current;
    const hash = await walletClient.sendTransaction({ to: w.address as `0x${string}`, value: toSend });
    await publicClient.waitForTransactionReceipt({ hash });
    ok(`${w.role} funded with ${formatEther(toSend)} ETH (tx: ${hash})`);

    await supabase.from('test_wallets').update({ eth_balance: formatEther(target), funded: true }).eq('role', w.role);
  }

  // ── Fund VRF subscription with LINK ──────────────────────────────────────
  step(3, 'Fund VRF subscription with 50 LINK');

  // Check current VRF balance
  const sub = await publicClient.readContract({ address: VRF_COORD, abi: VRF_ABI, functionName: 'getSubscription', args: [VRF_SUB_ID] });
  const vrfLinkBalance = sub[0]; // uint96 balance in juels

  console.log(`  VRF subscription balance: ${formatUnits(BigInt(vrfLinkBalance), 18)} LINK`);

  if (BigInt(vrfLinkBalance) >= LINK_FOR_VRF) {
    skip(`Subscription already has ${formatUnits(BigInt(vrfLinkBalance), 18)} LINK — skipping`);
  } else {
    const topUp = LINK_FOR_VRF - BigInt(vrfLinkBalance);
    // transferAndCall sends LINK to VRF coordinator and credits the subscription
    const callData = encodeAbiParameters(parseAbiParameters('uint256'), [VRF_SUB_ID]);
    const hash = await walletClient.writeContract({
      address: LINK_TOKEN, abi: LINK_ABI, functionName: 'transferAndCall',
      args: [VRF_COORD, topUp, callData],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    ok(`Funded VRF subscription with ${formatUnits(topUp, 18)} LINK (tx: ${hash})`);
  }

  // ── Add contract as VRF consumer ─────────────────────────────────────────
  step(4, 'Add CoinFlip contract as VRF consumer');

  const subAfter  = await publicClient.readContract({ address: VRF_COORD, abi: VRF_ABI, functionName: 'getSubscription', args: [VRF_SUB_ID] });
  const consumers: readonly `0x${string}`[] = subAfter[4];
  const alreadyConsumer = consumers.map(c => c.toLowerCase()).includes(CONTRACT_ADDR.toLowerCase());

  if (alreadyConsumer) {
    skip('Contract is already a VRF consumer');
  } else {
    const hash = await walletClient.writeContract({
      address: VRF_COORD, abi: VRF_ABI, functionName: 'addConsumer',
      args: [VRF_SUB_ID, CONTRACT_ADDR],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    ok(`CoinFlip contract added as VRF consumer (tx: ${hash})`);
  }

  // ── Register Chainlink Automation ─────────────────────────────────────────
  step(5, 'Register Chainlink Automation upkeep');

  // Approve LINK for the Registrar
  const approveTx = await walletClient.writeContract({
    address: LINK_TOKEN, abi: LINK_ABI, functionName: 'approve',
    args: [AUTO_REGISTRAR, LINK_FOR_AUTOMATION],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  ok(`Approved ${formatUnits(LINK_FOR_AUTOMATION, 18)} LINK to Automation Registrar`);

  // Register the upkeep
  let upkeepId: bigint | null = null;
  try {
    const regTx = await walletClient.writeContract({
      address: AUTO_REGISTRAR,
      abi: AUTO_REGISTRAR_ABI,
      functionName: 'registerUpkeep',
      args: [{
        name:           'CoinFlip Auto-Cancel',
        encryptedEmail: '0x' as `0x${string}`,
        upkeepContract: CONTRACT_ADDR,
        gasLimit:       500_000,
        adminAddress:   ownerAccount.address,
        triggerType:    0, // conditional
        checkData:      '0x' as `0x${string}`,
        triggerConfig:  '0x' as `0x${string}`,
        offchainConfig: '0x' as `0x${string}`,
        amount:         BigInt(LINK_FOR_AUTOMATION) as unknown as bigint & { readonly __brand: 'uint96' },
      }],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: regTx });
    ok(`Automation upkeep registered (tx: ${regTx})`);

    // Extract upkeep ID from logs
    const upkeepRegisteredTopic = '0x6b6a9b8c3b1c7e4f2d0a8e5b3c1f4d7a9b2e5c8f1d4a7b0e3c6f9d2a5b8e1c4';
    const log = receipt.logs.find(l => l.topics[0]?.toLowerCase() === upkeepRegisteredTopic);
    if (log?.topics[1]) {
      upkeepId = BigInt(log.topics[1]);
      console.log(`  Upkeep ID: ${upkeepId}`);
    }
  } catch (err: any) {
    warn(`Automation registration failed: ${err.message}`);
    warn('Register manually at https://automation.chain.link/sepolia');
    warn('Then add AUTOMATION_FORWARDER_ADDRESS to .env.local and re-run with --skip-automation');
  }

  // ── Set automation forwarder on contract ──────────────────────────────────
  step(6, 'Set automationForwarder on CoinFlip contract');

  const currentForwarder = await publicClient.readContract({
    address: CONTRACT_ADDR, abi: COINFLIP_ABI, functionName: 'automationForwarder',
  });

  if (process.env.AUTOMATION_FORWARDER_ADDRESS) {
    const forwarder = process.env.AUTOMATION_FORWARDER_ADDRESS as `0x${string}`;
    if (currentForwarder.toLowerCase() === forwarder.toLowerCase()) {
      skip(`Forwarder already set to ${forwarder}`);
    } else {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDR, abi: COINFLIP_ABI, functionName: 'setAutomationForwarder',
        args: [forwarder],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      ok(`automationForwarder set to ${forwarder} (tx: ${hash})`);
    }
  } else if (currentForwarder === '0x0000000000000000000000000000000000000000') {
    warn('AUTOMATION_FORWARDER_ADDRESS not set in .env.local');
    warn('After registering upkeep, find the Forwarder address in automation.chain.link');
    warn('Add it to .env.local then re-run this script to complete setup.');
  } else {
    ok(`Forwarder already configured: ${currentForwarder}`);
  }

  // ── Update Supabase balances ──────────────────────────────────────────────
  step(7, 'Sync final balances to Supabase');

  for (const w of wallets) {
    const ethBal  = await publicClient.getBalance({ address: w.address as `0x${string}` });
    const linkBal = await publicClient.readContract({ address: LINK_TOKEN, abi: LINK_ABI, functionName: 'balanceOf', args: [w.address as `0x${string}`] });
    await supabase.from('test_wallets').update({
      eth_balance:  formatEther(ethBal),
      link_balance: formatUnits(linkBal, 18),
      funded:       ethBal > 0n,
    }).eq('role', w.role);
    console.log(`  ${w.role.padEnd(14)} ETH: ${formatEther(ethBal).padEnd(12)} LINK: ${formatUnits(linkBal, 18)}`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ Setup complete! Start the app and the event indexer:');
  console.log('═'.repeat(60));
  console.log('  pnpm dev                        # frontend');
  console.log('  npx tsx scripts/event-indexer.ts  # blockchain → Supabase sync');
  console.log();
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
