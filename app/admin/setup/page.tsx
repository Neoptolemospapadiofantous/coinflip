'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import {
  Container,
  Section,
  Heading,
  Flex,
  Card,
  Text,
  Button,
  Badge,
  Code,
  Callout,
  Separator,
} from '@radix-ui/themes';
import { runDatabaseHealthCheck, DatabaseHealth } from '@/lib/dbHealthCheck';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Database,
  Layers,
  Activity,
  AlertTriangle,
} from 'lucide-react';

export default function SetupPage() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const runCheck = async () => {
    setLoading(true);
    try {
      const result = await runDatabaseHealthCheck();
      setHealth(result);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <Layout>
      <Section size="3">
        <Container size="3">
          <Flex direction="column" gap="6" py="6">
            {/* Header */}
            <Flex direction="column" gap="2">
              <Flex align="center" justify="between">
                <Heading size="8">Database Setup Verification</Heading>
                <Button onClick={runCheck} disabled={loading} variant="soft">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </Flex>
              <Text size="3" color="gray">
                Verify your Supabase database is configured correctly
              </Text>
            </Flex>

            {loading && !health && (
              <Card className="glass">
                <Flex align="center" justify="center" gap="3" p="9">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <Text size="4">Running health checks...</Text>
                </Flex>
              </Card>
            )}

            {health && (
              <>
                {/* Overall Status */}
                <Card className={health.overall ? 'glass border-2 border-green-500' : 'glass border-2 border-red-500'}>
                  <Flex direction="column" gap="4" p="6">
                    <Flex align="center" gap="3">
                      {health.overall ? (
                        <CheckCircle2 className="w-12 h-12 text-green-400" />
                      ) : (
                        <XCircle className="w-12 h-12 text-red-400" />
                      )}
                      <Flex direction="column" gap="1">
                        <Heading size="6">
                          {health.overall ? 'Database Ready!' : 'Setup Required'}
                        </Heading>
                        <Text size="2" color="gray">
                          {health.overall
                            ? 'All checks passed - you can switch to real data'
                            : 'Some components need configuration'}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Card>

                {/* Connection Status */}
                <Card className="glass">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Database className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Connection</Heading>
                      <StatusBadge success={health.connection.success} />
                    </Flex>

                    <Text size="2" color="gray">
                      {health.connection.message}
                    </Text>

                    {health.connection.details && (
                      <Code size="2">
                        {JSON.stringify(health.connection.details, null, 2)}
                      </Code>
                    )}

                    {!health.connection.success && (
                      <Callout.Root color="red">
                        <Callout.Icon>
                          <AlertTriangle className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          Check your <Code>.env.local</Code> file for Supabase credentials
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </Card>

                {/* Tables Status */}
                <Card className="glass">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Database Tables</Heading>
                    </Flex>

                    <Flex direction="column" gap="3">
                      {Object.entries(health.tables).map(([name, result]) => (
                        <Flex key={name} align="center" justify="between" p="3" className="glass rounded-lg">
                          <Flex align="center" gap="3">
                            <StatusIcon success={result.success} />
                            <Flex direction="column" gap="1">
                              <Text weight="bold">{name}</Text>
                              <Text size="1" color="gray">
                                {result.message}
                              </Text>
                            </Flex>
                          </Flex>
                          {result.details?.rowCount !== undefined && (
                            <Badge color="gray" variant="soft">
                              {result.details.rowCount} rows
                            </Badge>
                          )}
                        </Flex>
                      ))}
                    </Flex>

                    {(!health.tables.tiers.success ||
                      !health.tables.games.success ||
                      !health.tables.queue.success) && (
                      <Callout.Root color="orange">
                        <Callout.Icon>
                          <AlertTriangle className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          Run the SQL schema from <Code>SETUP_SUPABASE.md</Code>
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </Card>

                {/* Data Status */}
                <Card className="glass">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Database className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Data Verification</Heading>
                    </Flex>

                    <Flex align="center" justify="between" p="3" className="glass rounded-lg">
                      <Flex align="center" gap="3">
                        <StatusIcon success={health.data.tiersCount.success} />
                        <Flex direction="column" gap="1">
                          <Text weight="bold">Tier Configuration</Text>
                          <Text size="1" color="gray">
                            {health.data.tiersCount.message}
                          </Text>
                        </Flex>
                      </Flex>
                      {health.data.tiersCount.details?.count && (
                        <Badge color="cyan" variant="soft">
                          {health.data.tiersCount.details.count} tiers
                        </Badge>
                      )}
                    </Flex>

                    {!health.data.tiersCount.success && (
                      <Callout.Root color="orange">
                        <Callout.Icon>
                          <AlertTriangle className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          Insert tier data using the INSERT statements from <Code>SETUP_SUPABASE.md</Code>
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </Card>

                {/* Realtime Status */}
                <Card className="glass">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Realtime</Heading>
                      <StatusBadge success={health.realtime.success} />
                    </Flex>

                    <Text size="2" color="gray">
                      {health.realtime.message}
                    </Text>

                    {!health.realtime.success && (
                      <Callout.Root color="orange">
                        <Callout.Icon>
                          <AlertTriangle className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          Enable Realtime in Supabase Dashboard → Database → Replication
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </Card>

                {/* Next Steps */}
                {health.overall ? (
                  <Card className="glass border-2 border-green-500/30">
                    <Flex direction="column" gap="4" p="5">
                      <Heading size="4">✨ Next Steps</Heading>
                      <Text size="2" color="gray">
                        Your database is ready! Switch to real data:
                      </Text>
                      <Flex direction="column" gap="2">
                        <Code size="2">1. Open: hooks/useTiers.ts</Code>
                        <Code size="2">2. Change: USE_MOCK_DATA = false</Code>
                        <Code size="2">3. Restart: pnpm dev</Code>
                      </Flex>
                    </Flex>
                  </Card>
                ) : (
                  <Card className="glass border-2 border-orange-500/30">
                    <Flex direction="column" gap="4" p="5">
                      <Heading size="4">📖 Setup Guide</Heading>
                      <Text size="2" color="gray">
                        Follow the complete setup guide in <Code>SETUP_SUPABASE.md</Code>
                      </Text>
                    </Flex>
                  </Card>
                )}
              </>
            )}
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}

function StatusBadge({ success }: { success: boolean }) {
  return (
    <Badge color={success ? 'green' : 'red'} variant="soft">
      {success ? 'OK' : 'Failed'}
    </Badge>
  );
}

function StatusIcon({ success }: { success: boolean }) {
  return success ? (
    <CheckCircle2 className="w-5 h-5 text-green-400" />
  ) : (
    <XCircle className="w-5 h-5 text-red-400" />
  );
}
