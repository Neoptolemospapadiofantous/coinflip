/**
 * Show Migration SQL
 *
 * Displays all migration SQL for review and manual execution
 * No service role key required - just reads the files
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function showMigrations() {
  console.log('\n📋 Database Migration SQL\n');
  console.log('Copy and paste into Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor\n');
  console.log('='.repeat(80) + '\n');

  const migrationsDir = join(__dirname, '../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migrations:\n`);

  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`MIGRATION ${i + 1}/${migrationFiles.length}: ${file}`);
    console.log('='.repeat(80));
    console.log('\n' + sql + '\n');

    if (i < migrationFiles.length - 1) {
      console.log('\n' + '-'.repeat(80));
      console.log('👆 Copy the SQL above and run it in Supabase before proceeding');
      console.log('-'.repeat(80) + '\n');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All migrations shown above');
  console.log('='.repeat(80) + '\n');

  console.log('📝 Next Steps:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor');
  console.log('2. Copy & paste each migration SQL (in order)');
  console.log('3. Click "Run" after pasting each migration');
  console.log('4. Verify success before running the next migration');
  console.log('5. Run: pnpm tsx scripts/verify-production-setup.ts\n');
}

showMigrations();
