/**
 * Generates all wallets needed to run CoinFlip end-to-end.
 * Run: npx tsx scripts/generate-wallets.ts
 * Output is written to wallets.json (git-ignored) and printed to console.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

interface WalletEntry {
  role: string;
  description: string;
  address: string;
  privateKey: string;
  needsETH: string;
  needsLINK: string;
}

const ROLES = [
  {
    role: 'OWNER',
    description: 'Contract owner — deploys, configures, pauses, calls admin functions',
    needsETH: '0.5 ETH (gas for deploy + config txs)',
    needsLINK: '60 LINK (fund VRF subscription + Automation upkeep)',
  },
  {
    role: 'FEE_RECIPIENT',
    description: 'Receives 3% platform fee from every resolved game',
    needsETH: '0 (only receives, never sends)',
    needsLINK: '0',
  },
  {
    role: 'BOT_1',
    description: 'Test bot — creates games across all tiers',
    needsETH: '0.3 ETH (wagers + gas)',
    needsLINK: '0',
  },
  {
    role: 'BOT_2',
    description: 'Test bot — joins games created by BOT_1',
    needsETH: '0.3 ETH (wagers + gas)',
    needsLINK: '0',
  },
  {
    role: 'BOT_3',
    description: 'Test bot — stress-tests concurrency (creates + joins simultaneously)',
    needsETH: '0.3 ETH (wagers + gas)',
    needsLINK: '0',
  },
  {
    role: 'BOT_4',
    description: 'Test bot — cancels games to test refund flow',
    needsETH: '0.1 ETH (gas for cancels)',
    needsLINK: '0',
  },
  {
    role: 'BOT_5',
    description: 'Test bot — lets games expire to test VRF timeout / Automation flow',
    needsETH: '0.1 ETH (wagers + gas)',
    needsLINK: '0',
  },
];

async function main() {
  const wallets: WalletEntry[] = ROLES.map(role => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    return {
      ...role,
      address: account.address,
      privateKey,
    };
  });

  // Print to console
  console.log('\n========================================');
  console.log('  CoinFlip Wallet Generation');
  console.log('========================================\n');

  for (const w of wallets) {
    console.log(`[${w.role}]`);
    console.log(`  Description : ${w.description}`);
    console.log(`  Address     : ${w.address}`);
    console.log(`  Private Key : ${w.privateKey}`);
    console.log(`  Needs ETH   : ${w.needsETH}`);
    console.log(`  Needs LINK  : ${w.needsLINK}`);
    console.log();
  }

  // Faucet links
  console.log('========================================');
  console.log('  Sepolia Faucets (free testnet ETH)');
  console.log('========================================');
  console.log('  Alchemy   : https://sepoliafaucet.com');
  console.log('  Chainlink : https://faucets.chain.link/sepolia  (also gives LINK!)');
  console.log('  QuickNode : https://faucet.quicknode.com/ethereum/sepolia');
  console.log('  Infura    : https://www.infura.io/faucet/sepolia');
  console.log();
  console.log('  LINK Faucet (testnet LINK for VRF + Automation):');
  console.log('  https://faucets.chain.link/sepolia');
  console.log('  → Request for OWNER wallet only, ~20 LINK per request');
  console.log('  → You may need to request multiple times across days');
  console.log();

  // .env.local additions
  console.log('========================================');
  console.log('  Add to .env.local');
  console.log('========================================');
  const owner = wallets.find(w => w.role === 'OWNER')!;
  const feeRecipient = wallets.find(w => w.role === 'FEE_RECIPIENT')!;
  const bots = wallets.filter(w => w.role.startsWith('BOT'));

  console.log(`PRIVATE_KEY=${owner.privateKey}`);
  console.log(`FEE_RECIPIENT_ADDRESS=${feeRecipient.address}`);
  console.log(`FEE_RECIPIENT_PRIVATE_KEY=${feeRecipient.privateKey}`);
  bots.forEach((b, i) => {
    console.log(`BOT_${i + 1}_ADDRESS=${b.address}`);
    console.log(`BOT_${i + 1}_PRIVATE_KEY=${b.privateKey}`);
  });
  console.log();

  // Save to file
  const outPath = path.join(process.cwd(), 'wallets.json');
  fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2));
  console.log(`✅ Saved to wallets.json (keep this file SECRET — never commit it)`);
  console.log();
}

main().catch(console.error);
