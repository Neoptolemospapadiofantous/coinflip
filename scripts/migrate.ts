#!/usr/bin/env tsx

/**
 * Database Migration Runner
 *
 * Runs SQL migrations on Supabase database in order.
 * Run with: pnpm migrate
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

interface Migration {
  filename: string;
  version: string;
  sql: string;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

// Load all migration files
function loadMigrations(): Migration[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Alphabetical order ensures chronological order

  return files.map((filename) => {
    const version = filename.split('_')[0];
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');

    return { filename, version, sql };
  });
}

// Create migrations tracking table
async function createMigrationsTable(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS _migrations (
          version TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `,
    });

    if (error) {
      // RPC might not exist, try checking if table exists
      const { error: checkError } = await supabase
        .from('_migrations')
        .select('*')
        .limit(1);

      // Table doesn't exist and we can't create it
      if (checkError && (checkError.message.includes('does not exist') || checkError.message.includes('schema cache'))) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Get already executed migrations
async function getExecutedMigrations(supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('version')
      .order('version');

    if (error) {
      // Table doesn't exist yet - return empty array
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        return [];
      }
      throw error;
    }

    return data?.map((row: any) => row.version) || [];
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error.message && (error.message.includes('does not exist') || error.message.includes('schema cache'))) {
      return [];
    }
    throw error;
  }
}

// Execute a single migration
async function executeMigration(supabase: any, migration: Migration): Promise<boolean> {
  logInfo(`Executing: ${migration.filename}`);

  try {
    // Execute the SQL migration
    const { error: execError } = await supabase.rpc('exec_sql', {
      sql: migration.sql,
    });

    if (execError) {
      // Supabase might not have exec_sql, try direct query
      const lines = migration.sql.split(';').filter((line) => line.trim());

      for (const line of lines) {
        if (line.trim()) {
          const { error } = await supabase.from('_raw_sql').select('*').limit(0);
          // This is a workaround - we can't execute raw SQL directly from client
          // User needs to run migrations manually or use Supabase CLI
        }
      }

      logWarning(`Cannot execute SQL via client. Please run manually in Supabase SQL editor.`);
      return false;
    }

    // Record migration as executed
    const { error: insertError } = await supabase
      .from('_migrations')
      .insert({
        version: migration.version,
        filename: migration.filename,
      });

    if (insertError) {
      throw insertError;
    }

    logSuccess(`Completed: ${migration.filename}`);
    return true;
  } catch (error: any) {
    logError(`Failed to execute ${migration.filename}`);
    logError(`Error: ${error.message}`);
    throw error;
  }
}

// Main migration function
async function runMigrations() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CoinFlip Database Migrations');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logError('Supabase credentials not found in environment variables');
    logInfo('Please set:');
    logInfo('  NEXT_PUBLIC_SUPABASE_URL');
    logInfo('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  if (supabaseUrl.includes('your_supabase') || supabaseKey.includes('your_supabase')) {
    logError('Supabase credentials contain placeholder values');
    logInfo('Update your .env.local file with real values');
    process.exit(1);
  }

  logInfo(`Connecting to: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Load migrations
    const migrations = loadMigrations();
    logInfo(`Found ${migrations.length} migration files\n`);

    // Create migrations table if needed
    const tableCreated = await createMigrationsTable(supabase);
    if (!tableCreated) {
      logWarning('Migrations table does not exist - will create it with first migration\n');
    }

    // Get executed migrations
    const executed = await getExecutedMigrations(supabase);
    logInfo(`${executed.length} migrations already executed\n`);

    // Find pending migrations
    const pending = migrations.filter((m) => !executed.includes(m.version));

    if (pending.length === 0) {
      logSuccess('All migrations up to date! ✨\n');
      printManualInstructions(migrations);
      process.exit(0);
    }

    logInfo(`${pending.length} pending migrations:\n`);
    pending.forEach((m) => {
      log(`  - ${m.filename}`, colors.gray);
    });
    console.log();

    // Note about manual execution
    logWarning('IMPORTANT: Supabase client cannot execute DDL statements.');
    logInfo('You need to run migrations manually in Supabase SQL Editor.\n');

    printManualInstructions(pending);

    process.exit(0);
  } catch (error: any) {
    logError(`Migration failed: ${error.message}\n`);
    process.exit(1);
  }
}

function printManualInstructions(migrations: Migration[]) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📖 Manual Migration Instructions');
  console.log('═══════════════════════════════════════════════════════════\n');

  log('1. Go to your Supabase Dashboard', colors.bright);
  log('   ' + colors.cyan + 'https://supabase.com/dashboard' + colors.reset);

  log('\n2. Navigate to: SQL Editor\n', colors.bright);

  log('3. Run each migration in order:\n', colors.bright);

  migrations.forEach((migration, index) => {
    log(`   ${index + 1}. ${migration.filename}`, colors.cyan);
    log(`      File: supabase/migrations/${migration.filename}`, colors.gray);
  });

  console.log('\n' + colors.yellow + '⚡ Quick Copy-Paste:' + colors.reset + '\n');

  // First, create migrations tracking table
  console.log(colors.gray + '-- Create migrations tracking table (run this first)' + colors.reset);
  console.log(`CREATE TABLE IF NOT EXISTS _migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
  console.log();

  migrations.forEach((migration) => {
    console.log(colors.gray + '-- ' + migration.filename + colors.reset);
    console.log(migration.sql);
    console.log();
  });

  log('4. After running all migrations, verify with:', colors.bright);
  log('   pnpm verify-db\n', colors.cyan);

  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run migrations
runMigrations().catch((error) => {
  logError('Unexpected error:');
  console.error(error);
  process.exit(1);
});
