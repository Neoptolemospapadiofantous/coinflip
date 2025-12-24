/**
 * Production Setup Verification Script
 *
 * Verifies that all components are ready for production deployment
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: CheckResult[] = [];

function addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string) {
  results.push({ name, status, message });
}

async function checkEnvironmentVariables() {
  console.log('\n📋 Checking Environment Variables...\n');

  // Required for indexer
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA',
    'SEPOLIA_RPC_URL',
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID',
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];

    if (!value) {
      addResult(varName, 'fail', 'Not set');
    } else if (value.includes('your_') || value.includes('placeholder')) {
      addResult(varName, 'fail', 'Placeholder value detected - needs real value');
    } else {
      addResult(varName, 'pass', 'Set');
    }
  }

  // Check service role key format
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && !serviceRoleKey.startsWith('eyJ')) {
    addResult('SERVICE_ROLE_KEY Format', 'fail', 'Service role key should start with "eyJ" (JWT format)');
  } else if (serviceRoleKey?.startsWith('eyJ')) {
    addResult('SERVICE_ROLE_KEY Format', 'pass', 'Valid JWT format');
  }
}

async function checkDatabaseConnection() {
  console.log('\n🔌 Checking Database Connection...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('your_')) {
    addResult('Database Connection', 'fail', 'Cannot test - missing credentials');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Test connection
    const { error } = await supabase.from('games').select('count').limit(1);

    if (error) {
      addResult('Database Connection', 'fail', `Connection failed: ${error.message}`);
    } else {
      addResult('Database Connection', 'pass', 'Successfully connected');
    }
  } catch (err) {
    addResult('Database Connection', 'fail', `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function checkDatabaseSchema() {
  console.log('\n🗄️  Checking Database Schema...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('your_')) {
    addResult('Database Schema', 'fail', 'Cannot test - missing credentials');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if required tables exist
    const requiredTables = ['games', 'tiers', 'indexer_state', 'audit_log'];

    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        if (error.message.includes('does not exist')) {
          addResult(`Table: ${table}`, 'fail', 'Table does not exist');
        } else {
          addResult(`Table: ${table}`, 'warning', `Error accessing: ${error.message}`);
        }
      } else {
        addResult(`Table: ${table}`, 'pass', 'Exists and accessible');
      }
    }

    // Check for RLS policies
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_rls_enabled', {}, { count: 'exact' })
      .single();

    if (rlsError) {
      addResult('RLS Policies', 'warning', 'Could not verify RLS policies - function may not exist yet');
    }
  } catch (err) {
    addResult('Database Schema', 'fail', `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function checkIndexerState() {
  console.log('\n📊 Checking Indexer State...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('your_')) {
    addResult('Indexer State', 'fail', 'Cannot test - missing credentials');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('indexer_state')
      .select('*')
      .eq('indexer_name', 'coinflip_events')
      .single();

    if (error) {
      if (error.message.includes('0 rows')) {
        addResult('Indexer State', 'warning', 'Indexer state not initialized - will be created on first run');
      } else {
        addResult('Indexer State', 'fail', `Error: ${error.message}`);
      }
    } else {
      addResult('Indexer State', 'pass', `Last processed block: ${data.last_processed_block}`);
    }
  } catch (err) {
    addResult('Indexer State', 'fail', `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PRODUCTION SETUP VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name.padEnd(40)} ${result.message}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`Summary: ${passed} passed, ${warnings} warnings, ${failed} failed`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    console.log('⚠️  NEXT STEPS:\n');

    const serviceRoleIssue = results.find(r => r.name === 'SUPABASE_SERVICE_ROLE_KEY' && r.status === 'fail');
    if (serviceRoleIssue) {
      console.log('1. Get your Supabase service role key:');
      console.log('   - Go to: https://supabase.com/dashboard/project/_/settings/api');
      console.log('   - Copy the "service_role" key (NOT anon key)');
      console.log('   - Update .env.local: SUPABASE_SERVICE_ROLE_KEY=eyJh...\n');
    }

    const schemaIssues = results.filter(r => r.name.startsWith('Table:') && r.status === 'fail');
    if (schemaIssues.length > 0) {
      console.log('2. Run database migrations:');
      console.log('   - Open Supabase SQL Editor');
      console.log('   - Run: supabase/migrations/001_initial_schema.sql');
      console.log('   - Run: supabase/migrations/002_games_table.sql');
      console.log('   - Run: supabase/migrations/003_indexer_state.sql');
      console.log('   - Run: supabase/migrations/004_secure_rls_policies.sql\n');
    }

    console.log('3. After fixing issues, run this script again:\n');
    console.log('   pnpm tsx scripts/verify-production-setup.ts\n');
  } else if (warnings > 0) {
    console.log('✅ System is ready for production with minor warnings');
    console.log('⚠️  Review warnings above and address if needed\n');
  } else {
    console.log('✅ All checks passed! System is ready for production\n');
    console.log('Next steps:');
    console.log('1. Start the production indexer: pnpm indexer:prod');
    console.log('2. Monitor health: curl http://localhost:3001/health');
    console.log('3. Test game lifecycle end-to-end\n');
  }
}

async function main() {
  console.log('🚀 Starting Production Setup Verification...\n');

  await checkEnvironmentVariables();
  await checkDatabaseConnection();
  await checkDatabaseSchema();
  await checkIndexerState();

  printResults();
}

main().catch(console.error);
