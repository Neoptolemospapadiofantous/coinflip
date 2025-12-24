/**
 * Run Migrations on Supabase (Cloud)
 *
 * Runs migrations against your Supabase cloud database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your_service_role_key')) {
  console.error('❌ Missing or invalid environment variables!');
  console.error('\nPlease update .env.local with:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ... (your actual service role key)');
  console.error('\nGet service role key from:');
  console.error('   https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runCloudMigrations() {
  console.log('\n🌩️  Running Migrations on Supabase Cloud...\n');
  console.log('📍 Supabase URL:', SUPABASE_URL);
  console.log('🔑 Service Role Key:', SERVICE_ROLE_KEY.substring(0, 20) + '...');
  console.log('');

  const migrationsDir = join(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${migrationFiles.length} migration files:\n`);
  migrationFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  console.log('⚠️  Note: Supabase requires migrations to be run in SQL Editor');
  console.log('📝 Instructions:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor');
  console.log('2. Copy & paste each migration SQL below');
  console.log('3. Click "Run" after pasting');
  console.log('4. Verify success before next migration\n');
  console.log('='.repeat(80) + '\n');

  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`-- ============================================================`);
    console.log(`-- MIGRATION ${i + 1}/${migrationFiles.length}: ${file}`);
    console.log(`-- ============================================================\n`);
    console.log(sql);
    console.log('\n');

    if (i < migrationFiles.length - 1) {
      console.log('👆 Copy the SQL above, run it in Supabase, then continue\n');
      console.log('-'.repeat(80) + '\n');
    }
  }

  console.log('='.repeat(80));
  console.log('\n✅ All migration SQL shown above');
  console.log('📋 Run each one in Supabase SQL Editor\n');
}

runCloudMigrations();
