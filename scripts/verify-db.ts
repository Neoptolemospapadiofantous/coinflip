#!/usr/bin/env tsx

/**
 * Database Verification Script
 *
 * Checks if Supabase is properly configured with all required tables and data.
 * Run with: pnpm verify-db
 */

import { runDatabaseHealthCheck } from '../lib/dbHealthCheck';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CoinFlip Database Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  const health = await runDatabaseHealthCheck();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Detailed Results');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Connection
  console.log('🔌 CONNECTION:');
  console.log(`   Status: ${health.connection.success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Message: ${health.connection.message}`);
  if (health.connection.details) {
    console.log(`   Details:`, health.connection.details);
  }

  // Tables
  console.log('\n📋 TABLES:');
  Object.entries(health.tables).forEach(([name, result]) => {
    console.log(`   ${name}: ${result.success ? '✅' : '❌'} ${result.message}`);
    if (result.details?.rowCount !== undefined) {
      console.log(`      Rows: ${result.details.rowCount}`);
    }
  });

  // Data
  console.log('\n📊 DATA:');
  console.log(`   Tiers: ${health.data.tiersCount.success ? '✅' : '❌'} ${health.data.tiersCount.message}`);
  if (health.data.tiersCount.details?.count !== undefined) {
    console.log(`      Count: ${health.data.tiersCount.details.count}`);
  }

  // Realtime
  console.log('\n⚡ REALTIME:');
  console.log(`   Status: ${health.realtime.success ? '✅ Enabled' : '❌ Not enabled'}`);
  console.log(`   Message: ${health.realtime.message}`);

  // Overall
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  ${health.overall ? '✅ DATABASE READY' : '❌ SETUP REQUIRED'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!health.overall) {
    console.log('⚠️  ACTION REQUIRED:\n');

    if (!health.connection.success) {
      console.log('   1. Check your .env.local file:');
      console.log('      - NEXT_PUBLIC_SUPABASE_URL');
      console.log('      - NEXT_PUBLIC_SUPABASE_ANON_KEY\n');
    }

    if (!health.tables.tiers.success || !health.tables.games.success || !health.tables.queue.success) {
      console.log('   2. Run the SQL schema in Supabase:');
      console.log('      See SETUP_SUPABASE.md for complete SQL\n');
    }

    if (!health.data.tiersCount.success) {
      console.log('   3. Insert tier data:');
      console.log('      Run the INSERT statements from SETUP_SUPABASE.md\n');
    }

    if (!health.realtime.success) {
      console.log('   4. Enable Realtime in Supabase:');
      console.log('      Dashboard → Database → Replication');
      console.log('      Enable for: tiers, games, queue\n');
    }

    console.log('   📖 Full setup guide: ./SETUP_SUPABASE.md\n');

    process.exit(1);
  } else {
    console.log('✨ Everything looks good! You can switch to real data:\n');
    console.log('   1. Open hooks/useTiers.ts');
    console.log('   2. Change: USE_MOCK_DATA = false');
    console.log('   3. Restart: pnpm dev\n');

    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Verification failed with error:', error);
  process.exit(1);
});
