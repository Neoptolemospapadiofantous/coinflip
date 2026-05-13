/**
 * Step 1 of 2: Generate all CoinFlip testnet wallets and save them to Supabase + .env.local.
 *
 * Run: npx tsx scripts/setup-wallets.ts
 *
 * What it does:
 *   1. Generates 7 wallets (owner, fee recipient, 5 bots)
 *   2. Saves them to the test_wallets table in Supabase
 *   3. Appends the private keys + addresses to .env.local
 *   4. Prints funding instructions
 *
 * Run scripts/fund-wallets.ts next (after manually funding OWNER with ETH + LINK from faucet).
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WALLET_ROLES = [
  {
    role: 'OWNER',
    description: 'Contract owner — deploys, configures, pauses, calls admin functions',
    needs_eth: '0.5 ETH (gas for deploy + config txs)',
    needs_link: '60 LINK (VRF subscription 50 + Automation upkeep 10)',
  },
  {
    role: 'FEE_RECIPIENT',
    description: 'Receives 3% platform fee from every resolved game',
    needs_eth: '0 (only receives, never sends)',
    needs_link: '0',
  },
  {
    role: 'BOT_1',
    description: 'Test bot — creates games across all tiers',
    needs_eth: '0.3 ETH',
    needs_link: '0',
  },
  {
    role: 'BOT_2',
    description: 'Test bot — joins games (opponent to BOT_1)',
    needs_eth: '0.3 ETH',
    needs_link: '0',
  },
  {
    role: 'BOT_3',
    description: 'Test bot — concurrency stress test (creates + joins simultaneously)',
    needs_eth: '0.3 ETH',
    needs_link: '0',
  },
  {
    role: 'BOT_4',
    description: 'Test bot — cancels games to exercise refund flow',
    needs_eth: '0.1 ETH',
    needs_link: '0',
  },
  {
    role: 'BOT_5',
    description: 'Test bot — lets games expire to exercise VRF timeout + Automation',
    needs_eth: '0.1 ETH',
    needs_link: '0',
  },
];

async function main() {
  console.log('\n🔑 Generating CoinFlip testnet wallets...\n');

  // Generate
  const wallets = WALLET_ROLES.map(role => {
    const privateKey = generatePrivateKey();
    const { address } = privateKeyToAccount(privateKey);
    return { ...role, address, private_key: privateKey, network: 'sepolia' };
  });

  // Upsert into Supabase (re-running the script won't duplicate)
  const { error } = await supabase
    .from('test_wallets')
    .upsert(wallets, { onConflict: 'role' });

  if (error) {
    console.error('❌ Supabase error:', error.message);
    console.log('\nMake sure migration 037_test_wallets.sql has been applied first.');
    process.exit(1);
  }

  console.log('✅ Wallets saved to Supabase (test_wallets table)\n');

  // Print table
  console.log('─'.repeat(80));
  for (const w of wallets) {
    console.log(`[${w.role}]`);
    console.log(`  Address     : ${w.address}`);
    console.log(`  Private Key : ${w.private_key}`);
    console.log(`  Needs ETH   : ${w.needs_eth}`);
    console.log(`  Needs LINK  : ${w.needs_link}`);
    console.log();
  }
  console.log('─'.repeat(80));

  // Patch .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  const owner = wallets.find(w => w.role === 'OWNER')!;
  const fee   = wallets.find(w => w.role === 'FEE_RECIPIENT')!;
  const bots  = wallets.filter(w => w.role.startsWith('BOT'));

  const envBlock = [
    '',
    '# ===========================================',
    '# Generated Testnet Wallets (setup-wallets.ts)',
    '# ===========================================',
    `PRIVATE_KEY=${owner.private_key}`,
    `OWNER_ADDRESS=${owner.address}`,
    `FEE_RECIPIENT_ADDRESS=${fee.address}`,
    `FEE_RECIPIENT_PRIVATE_KEY=${fee.private_key}`,
    ...bots.flatMap((b, i) => [
      `BOT_${i + 1}_ADDRESS=${b.address}`,
      `BOT_${i + 1}_PRIVATE_KEY=${b.private_key}`,
    ]),
  ].join('\n');

  // Remove any previous generated block to avoid duplicates on re-run
  envContent = envContent.replace(
    /\n# =+\n# Generated Testnet Wallets[\s\S]*?(?=\n# =+|\n[A-Z_]+=|$)/,
    '',
  );
  fs.writeFileSync(envPath, envContent + envBlock + '\n');
  console.log('\n✅ .env.local updated with new wallet keys\n');

  // Funding instructions
  const ownerAddr = owner.address;
  console.log('═'.repeat(80));
  console.log('  NEXT STEP: Fund the OWNER wallet, then run fund-wallets.ts');
  console.log('═'.repeat(80));
  console.log(`\n  OWNER address: ${ownerAddr}\n`);
  console.log('  1. Get Sepolia ETH (need ~0.5 ETH):');
  console.log('     https://sepoliafaucet.com                      (Alchemy, 0.5/day)');
  console.log('     https://faucet.quicknode.com/ethereum/sepolia  (QuickNode, 0.5/day)');
  console.log('     https://www.infura.io/faucet/sepolia           (Infura, 0.5/day)');
  console.log();
  console.log('  2. Get Sepolia LINK (need ~60 LINK, do this 3x on separate days):');
  console.log('     https://faucets.chain.link/sepolia             (Chainlink, 20/request)');
  console.log('     → This faucet also gives 0.1 ETH per request');
  console.log();
  console.log('  Once OWNER has ETH + LINK, run:');
  console.log('     npx tsx scripts/fund-wallets.ts\n');
}

main().catch(err => { console.error(err); process.exit(1); });
