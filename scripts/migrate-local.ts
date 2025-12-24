/**
 * Run Migrations on Local PostgreSQL
 *
 * Runs migrations against local Docker PostgreSQL database
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const LOCAL_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'coinflip',
};

async function runLocalMigrations() {
  console.log('\n🚀 Running Migrations on Local Database...\n');
  console.log('📍 Database:', LOCAL_DB_CONFIG.database);
  console.log('📍 Host:', LOCAL_DB_CONFIG.host);
  console.log('📍 Port:', LOCAL_DB_CONFIG.port);
  console.log('');

  const client = new Client(LOCAL_DB_CONFIG);

  try {
    // Connect to database
    console.log('🔌 Connecting to local database...');
    await client.connect();
    console.log('✅ Connected!\n');

    const migrationsDir = join(__dirname, '../supabase/migrations');
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
        await client.query(sql);
        console.log(`   ✅ Success!\n`);
        successCount++;
      } catch (err: any) {
        console.log(`   ❌ Error: ${err.message}\n`);
        errorCount++;

        // Continue with other migrations even if one fails
        // (in case some tables already exist)
      }
    }

    console.log('='.repeat(60));
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${migrationFiles.length}\n`);

    if (errorCount === 0) {
      console.log('✅ All migrations completed successfully!\n');
    } else {
      console.log('⚠️  Some migrations failed (may be normal if tables already exist)\n');
    }

    // Verify tables exist
    console.log('🔍 Verifying database schema...\n');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables created:');
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log('');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Disconnected from database\n');
  }
}

runLocalMigrations();
