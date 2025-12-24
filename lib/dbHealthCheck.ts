import { supabase } from './supabase';

export interface HealthCheckResult {
  success: boolean;
  message: string;
  details?: any;
}

export interface DatabaseHealth {
  connection: HealthCheckResult;
  migrations: HealthCheckResult;
  tables: {
    tiers: HealthCheckResult;
    games: HealthCheckResult;
    queue: HealthCheckResult;
  };
  data: {
    tiersCount: HealthCheckResult;
  };
  realtime: HealthCheckResult;
  overall: boolean;
}

// Check if Supabase is configured
export async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        message: 'Supabase environment variables not configured',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        },
      };
    }

    if (supabaseUrl.includes('your_supabase') || supabaseKey.includes('your_supabase')) {
      return {
        success: false,
        message: 'Supabase environment variables contain placeholder values',
      };
    }

    // Try a simple query to test connection
    const { error } = await supabase.from('tiers').select('count', { count: 'exact', head: true });

    if (error) {
      return {
        success: false,
        message: `Supabase connection failed: ${error.message}`,
        details: error,
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection error: ${error.message}`,
      details: error,
    };
  }
}

// Check if a table exists and is accessible
async function checkTable(tableName: string): Promise<HealthCheckResult> {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('does not exist')) {
        return {
          success: false,
          message: `Table '${tableName}' does not exist`,
          details: error,
        };
      }
      return {
        success: false,
        message: `Error accessing table '${tableName}': ${error.message}`,
        details: error,
      };
    }

    return {
      success: true,
      message: `Table '${tableName}' exists and is accessible`,
      details: { rowCount: count },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Exception checking table '${tableName}': ${error.message}`,
      details: error,
    };
  }
}

// Check if tiers table has data
async function checkTiersData(): Promise<HealthCheckResult> {
  try {
    const { data, error, count } = await supabase
      .from('tiers')
      .select('*', { count: 'exact' })
      .eq('enabled', true);

    if (error) {
      return {
        success: false,
        message: `Error fetching tiers: ${error.message}`,
        details: error,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'Tiers table is empty - run the setup SQL',
        details: { count: 0 },
      };
    }

    if (data.length < 5) {
      return {
        success: false,
        message: `Only ${data.length} tiers found, expected 5`,
        details: { count: data.length, tiers: data },
      };
    }

    return {
      success: true,
      message: `Found ${data.length} tiers configured`,
      details: { count: data.length, tiers: data },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Exception checking tiers data: ${error.message}`,
      details: error,
    };
  }
}

// Check if migrations have been run
async function checkMigrations(): Promise<HealthCheckResult> {
  try {
    // Check if _migrations table exists
    const { data: migrationData, error: migrationError } = await supabase
      .from('_migrations')
      .select('*', { count: 'exact' });

    if (migrationError) {
      if (migrationError.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Migrations table does not exist - run migrations with: pnpm migrate',
          details: { hint: 'Execute migrations in Supabase SQL Editor' },
        };
      }
      return {
        success: false,
        message: `Error checking migrations: ${migrationError.message}`,
        details: migrationError,
      };
    }

    const executedCount = migrationData?.length || 0;
    const expectedCount = 5; // We have 5 initial migrations

    if (executedCount === 0) {
      return {
        success: false,
        message: 'No migrations executed - run: pnpm migrate',
        details: { executedCount, expectedCount },
      };
    }

    if (executedCount < expectedCount) {
      return {
        success: false,
        message: `Only ${executedCount}/${expectedCount} migrations executed`,
        details: {
          executedCount,
          expectedCount,
          executed: migrationData?.map((m: any) => m.filename) || [],
        },
      };
    }

    return {
      success: true,
      message: `All ${executedCount} migrations executed successfully`,
      details: {
        executedCount,
        migrations: migrationData?.map((m: any) => ({
          version: m.version,
          filename: m.filename,
          executedAt: m.executed_at,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Exception checking migrations: ${error.message}`,
      details: error,
    };
  }
}

// Check if realtime is enabled
async function checkRealtime(): Promise<HealthCheckResult> {
  try {
    // Create a test subscription to verify realtime works
    const channel = supabase.channel('health-check-test');
    let isResolved = false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          try {
            channel.unsubscribe();
          } catch (e) {
            // Ignore unsubscribe errors
          }
          resolve({
            success: false,
            message: 'Realtime connection timeout - may not be enabled',
          });
        }
      }, 5000);

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tiers' }, () => {})
        .subscribe((status) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);

            // Delay unsubscribe to avoid call stack issues
            setTimeout(() => {
              try {
                channel.unsubscribe();
              } catch (e) {
                // Ignore unsubscribe errors
              }
            }, 100);

            if (status === 'SUBSCRIBED') {
              resolve({
                success: true,
                message: 'Realtime is enabled and working',
              });
            } else {
              resolve({
                success: false,
                message: `Realtime subscription status: ${status}`,
                details: { status },
              });
            }
          }
        });
    });
  } catch (error: any) {
    return {
      success: false,
      message: `Realtime check failed: ${error.message}`,
      details: error,
    };
  }
}

// Comprehensive health check
export async function runDatabaseHealthCheck(): Promise<DatabaseHealth> {
  console.log('🔍 Running database health check...');

  const connection = await checkSupabaseConnection();
  console.log('  Connection:', connection.success ? '✅' : '❌', connection.message);

  let migrations = {
    success: false,
    message: 'Skipped - connection failed',
  } as HealthCheckResult;

  let tablesCheck = {
    tiers: { success: false, message: 'Skipped - connection failed' } as HealthCheckResult,
    games: { success: false, message: 'Skipped - connection failed' } as HealthCheckResult,
    queue: { success: false, message: 'Skipped - connection failed' } as HealthCheckResult,
  };

  let tiersCount = {
    success: false,
    message: 'Skipped - connection failed',
  } as HealthCheckResult;

  let realtime = {
    success: false,
    message: 'Skipped - connection failed',
  } as HealthCheckResult;

  // Only check migrations and tables if connection succeeded
  if (connection.success) {
    migrations = await checkMigrations();
    console.log('  Migrations:', migrations.success ? '✅' : '❌', migrations.message);

    tablesCheck.tiers = await checkTable('tiers');
    console.log('  Tiers table:', tablesCheck.tiers.success ? '✅' : '❌', tablesCheck.tiers.message);

    tablesCheck.games = await checkTable('games');
    console.log('  Games table:', tablesCheck.games.success ? '✅' : '❌', tablesCheck.games.message);

    tablesCheck.queue = await checkTable('queue');
    console.log('  Queue table:', tablesCheck.queue.success ? '✅' : '❌', tablesCheck.queue.message);

    // Check tiers data if table exists
    if (tablesCheck.tiers.success) {
      tiersCount = await checkTiersData();
      console.log('  Tiers data:', tiersCount.success ? '✅' : '❌', tiersCount.message);
    }

    // Check realtime
    realtime = await checkRealtime();
    console.log('  Realtime:', realtime.success ? '✅' : '❌', realtime.message);
  }

  const overall =
    connection.success &&
    migrations.success &&
    tablesCheck.tiers.success &&
    tablesCheck.games.success &&
    tablesCheck.queue.success &&
    tiersCount.success &&
    realtime.success;

  console.log('\n📊 Overall Status:', overall ? '✅ READY' : '❌ SETUP REQUIRED');

  return {
    connection,
    migrations,
    tables: tablesCheck,
    data: { tiersCount },
    realtime,
    overall,
  };
}

// Quick check - just connection and tiers
export async function quickHealthCheck(): Promise<boolean> {
  const connection = await checkSupabaseConnection();
  if (!connection.success) return false;

  const tiersTable = await checkTable('tiers');
  if (!tiersTable.success) return false;

  const tiersData = await checkTiersData();
  return tiersData.success;
}
