/**
 * Run Database Migrations
 *
 * Executes all migrations in order against your Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
  console.error('\nPlease update your .env.local file with the service role key.');
  console.error('Get it from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api');
  process.exit(1);
}

if (SERVICE_ROLE_KEY.includes('your_service_role_key')) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is still set to placeholder value!');
  console.error('\nPlease update .env.local with your actual service role key.');
  console.error('Get it from: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/settings/api');
  process.exit(1);
}

// Create Supabase client with service role (has admin access)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  console.log('\n🚀 Starting Database Migrations...\n');
  console.log('📍 Supabase URL:', SUPABASE_URL);
  console.log('🔑 Using Service Role Key:', SERVICE_ROLE_KEY.substring(0, 20) + '...\n');

  const migrationsDir = join(__dirname, '../supabase/migrations');

  // Get all migration files in order
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${migrationFiles.length} migration files:\n`);
  migrationFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`⏳ Running: ${file}...`);

    try {
      // Execute the SQL
      const { data, error } = await supabase.rpc('exec_sql', { query: sql });

      if (error) {
        // If exec_sql doesn't exist, try direct SQL execution
        // This won't work for all SQL but let's try
        console.log('   ⚠️  exec_sql not available, trying alternative method...');

        // For now, we'll just show the SQL and ask user to run it manually
        console.log('   ⚠️  This migration needs to be run in Supabase SQL Editor');
        console.log(`   📋 File: ${file}`);
        errorCount++;
      } else {
        console.log(`   ✅ Success: ${file}`);
        successCount++;
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      errorCount++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📝 Total: ${migrationFiles.length}\n`);

  if (errorCount > 0) {
    console.log('⚠️  Some migrations need to be run manually in Supabase SQL Editor.');
    console.log('\n📝 Manual Migration Instructions:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor');
    console.log('   2. Run each migration file in order:');
    migrationFiles.forEach(file => {
      console.log(`      - supabase/migrations/${file}`);
    });
    console.log('   3. Copy & paste the SQL and click "Run"');
    console.log('   4. Verify success before proceeding to next migration\n');
  } else {
    console.log('✅ All migrations completed successfully!\n');
  }
}

// Alternative: Just print the SQL for manual execution
async function printMigrations() {
  console.log('\n📋 Migration SQL for Manual Execution\n');
  console.log('Copy and paste these into Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor\n');
  console.log('='.repeat(80) + '\n');

  const migrationsDir = join(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`-- ============================================================`);
    console.log(`-- Migration: ${file}`);
    console.log(`-- ============================================================\n`);
    console.log(sql);
    console.log('\n\n');
  }

  console.log('='.repeat(80));
  console.log('\n✅ Copy the SQL above and run it in Supabase SQL Editor\n');
}

// Check command line argument
const mode = process.argv[2] || 'print';

if (mode === 'run') {
  runMigrations().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
} else {
  // Default: just print the migrations for manual execution
  printMigrations().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}
