'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
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
  ShieldAlert,
  Wallet,
} from 'lucide-react';

// Admin whitelist - add authorized wallet addresses here
const ADMIN_ADDRESSES: string[] = [
  // Add admin addresses in lowercase
  // Example: '0x1234...'.toLowerCase()
];

// Check if address is admin (also allow access in development with no admins configured)
function isAdmin(address: string | undefined): boolean {
  if (!address) return false;
  // If no admins configured, allow in development only
  if (ADMIN_ADDRESSES.length === 0) {
    return process.env.NODE_ENV === 'development';
  }
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

export default function SetupPage() {
  const { address, isConnected } = useAccount();
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const authorized = isAdmin(address);

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
    if (authorized) {
      runCheck();
    }
  }, [authorized]);

  // Not connected - show connect wallet prompt
  if (!isConnected) {
    return (
      <Layout>
        <Section size="3">
          <Container size="2">
            <Card className="card-simple mt-20">
              <Flex direction="column" gap="4" p="8" align="center">
                <Wallet className="w-16 h-16 text-cyan-400" />
                <Heading size="6">Connect Wallet</Heading>
                <Text size="3" color="gray" align="center">
                  Please connect your wallet to access the admin panel.
                </Text>
              </Flex>
            </Card>
          </Container>
        </Section>
      </Layout>
    );
  }

  // Connected but not authorized
  if (!authorized) {
    return (
      <Layout>
        <Section size="3">
          <Container size="2">
            <Card className="card-simple border-2 border-red-500/50 mt-20">
              <Flex direction="column" gap="4" p="8" align="center">
                <ShieldAlert className="w-16 h-16 text-red-400" />
                <Heading size="6" className="text-red-400">Access Denied</Heading>
                <Text size="3" color="gray" align="center">
                  Your wallet address is not authorized to access this page.
                </Text>
                <Code size="2" className="mt-2">
                  {address}
                </Code>
              </Flex>
            </Card>
          </Container>
        </Section>
      </Layout>
    );
  }

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
              <Card className="card-simple">
                <Flex align="center" justify="center" gap="3" p="9">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <Text size="4">Running health checks...</Text>
                </Flex>
              </Card>
            )}

            {health && (
              <>
                {/* Overall Status */}
                <Card className={health.overall ? 'card-simple border-2 border-green-500' : 'card-simple border-2 border-red-500'}>
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
                <Card className="card-simple">
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

                {/* Migrations Status */}
                <Card className="card-simple">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Migrations</Heading>
                      <StatusBadge success={health.migrations.success} />
                    </Flex>

                    <Text size="2" color="gray">
                      {health.migrations.message}
                    </Text>

                    {health.migrations.details?.migrations && (
                      <Flex direction="column" gap="2">
                        <Text size="1" weight="bold" color="gray">
                          Executed Migrations:
                        </Text>
                        {(health.migrations.details.migrations as Array<{ version: number; filename: string }>).map((m) => (
                          <Code key={m.version} size="1">
                            {m.filename}
                          </Code>
                        ))}
                      </Flex>
                    )}

                    {!health.migrations.success && (
                      <Callout.Root color="red">
                        <Callout.Icon>
                          <AlertTriangle className="w-4 h-4" />
                        </Callout.Icon>
                        <Callout.Text>
                          Run migrations with <Code>pnpm migrate</Code> and execute the SQL in Supabase.
                          See <Code>DATABASE_MIGRATIONS.md</Code> for details.
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </Card>

                {/* Tables Status */}
                <Card className="card-simple">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Database Tables</Heading>
                    </Flex>

                    <Flex direction="column" gap="3">
                      {Object.entries(health.tables).map(([name, result]) => (
                        <Flex key={name} align="center" justify="between" p="3" className="card-simple rounded-lg">
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
                              {String(result.details.rowCount)} rows
                            </Badge>
                          )}
                        </Flex>
                      ))}
                    </Flex>

                    {(!health.tables.tiers.success ||
                      !health.tables.games.success ||
                      !health.tables.queue.success) && (
                      <Callout.Root color="yellow">
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
                <Card className="card-simple">
                  <Flex direction="column" gap="4" p="5">
                    <Flex align="center" gap="2">
                      <Database className="w-5 h-5 text-cyan-400" />
                      <Heading size="4">Data Verification</Heading>
                    </Flex>

                    <Flex align="center" justify="between" p="3" className="card-simple rounded-lg">
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
                          {String(health.data.tiersCount.details.count)} tiers
                        </Badge>
                      )}
                    </Flex>

                    {!health.data.tiersCount.success && (
                      <Callout.Root color="yellow">
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
                <Card className="card-simple">
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
                      <Callout.Root color="yellow">
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
                  <Card className="glass border-2 border-yellow-400/30">
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
