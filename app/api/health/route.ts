import { NextResponse } from 'next/server';
import { quickHealthCheck, runDatabaseHealthCheck } from '@/lib/dbHealthCheck';

// Health check endpoint for load balancers and monitoring
// GET /api/health - Quick check (for load balancers, returns fast)
// GET /api/health?detailed=true - Full check (for debugging)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  const startTime = Date.now();

  try {
    if (detailed) {
      // Full health check - takes longer but provides comprehensive status
      const health = await runDatabaseHealthCheck();
      const duration = Date.now() - startTime;

      return NextResponse.json(
        {
          status: health.overall ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          duration_ms: duration,
          checks: {
            database: health.connection.success,
            migrations: health.migrations.success,
            tables: {
              tiers: health.tables.tiers.success,
              games: health.tables.games.success,
              indexer_state: health.tables.indexer_state.success,
            },
            data: health.data.tiersCount.success,
            realtime: health.realtime.success,
          },
          details: {
            connection: health.connection,
            migrations: health.migrations,
            tables: health.tables,
            data: health.data,
            realtime: health.realtime,
          },
        },
        { status: health.overall ? 200 : 503 }
      );
    }

    // Quick health check - for load balancers (should respond in <1s)
    const isHealthy = await quickHealthCheck();
    const duration = Date.now() - startTime;

    if (isHealthy) {
      return NextResponse.json(
        {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          duration_ms: duration,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        message: 'Database health check failed',
      },
      { status: 503 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        message: `Health check failed: ${message}`,
      },
      { status: 503 }
    );
  }
}

// HEAD request for simple alive check (no body)
export async function HEAD() {
  try {
    const isHealthy = await quickHealthCheck();
    return new NextResponse(null, { status: isHealthy ? 200 : 503 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
