'use client';

import { useState } from 'react';
import { Flex, Card, Text, Heading, Box, Grid, Button, Switch, TextField, Separator } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  User,
  Bell,
  Wallet,
  Shield,
  Mail,
  Link as LinkIcon,
  Unlink,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function SettingsPage() {
  const { user, linkCurrentWallet, unlinkWallet, isWalletLinked } = useAuth();
  const { address, isConnected } = useAccount();
  const [saving, setSaving] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    gameMatched: true,
    gameResolved: true,
    emailNotifications: false,
    soundEnabled: true,
  });

  const handleSavePreferences = async () => {
    setSaving(true);
    // Simulate save - would normally call API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setMessage({ type: 'success', text: 'Preferences saved successfully!' });
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLinkWallet = async () => {
    if (!address) return;
    setLinkingWallet(true);
    const result = await linkCurrentWallet();
    if (result.success) {
      setMessage({ type: 'success', text: 'Wallet linked successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to link wallet' });
    }
    setLinkingWallet(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUnlinkWallet = async () => {
    setLinkingWallet(true);
    const result = await unlinkWallet();
    if (result.success) {
      setMessage({ type: 'success', text: 'Wallet unlinked successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to unlink wallet' });
    }
    setLinkingWallet(false);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <DashboardLayout title="Settings" description="Manage your account and preferences.">
      <Flex direction="column" gap="6">
        {/* Status Message */}
        {message && (
          <Flex
            align="center"
            gap="2"
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <Text size="2" color={message.type === 'success' ? 'green' : 'red'}>
              {message.text}
            </Text>
          </Flex>
        )}

        {/* Account Settings */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <User className="w-5 h-5 text-cyan-400" />
              <Heading size="4">Account</Heading>
            </Flex>
            <Separator size="4" />
            <Grid columns={{ initial: '1', md: '2' }} gap="4">
              <Box>
                <Text as="label" size="2" weight="medium" className="block mb-2">
                  Email Address
                </Text>
                <TextField.Root
                  size="3"
                  value={user?.email || ''}
                  disabled
                >
                  <TextField.Slot>
                    <Mail className="w-4 h-4 text-gray-400" />
                  </TextField.Slot>
                </TextField.Root>
                <Text size="1" color="gray" className="mt-1">
                  Email cannot be changed
                </Text>
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" className="block mb-2">
                  Account Created
                </Text>
                <TextField.Root
                  size="3"
                  value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  disabled
                />
              </Box>
            </Grid>
          </Flex>
        </Card>

        {/* Wallet Settings */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <Wallet className="w-5 h-5 text-purple-400" />
              <Heading size="4">Wallet</Heading>
            </Flex>
            <Separator size="4" />
            <Flex direction="column" gap="4">
              {isConnected ? (
                <>
                  <Flex align="center" justify="between" className="p-4 rounded-lg bg-slate-800/50">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">Connected Wallet</Text>
                      <Text size="2" color="cyan" className="font-mono">
                        {address}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="2">
                      <Box className="w-2 h-2 rounded-full bg-green-400" />
                      <Text size="2" color="green">Connected</Text>
                    </Flex>
                  </Flex>

                  {isWalletLinked ? (
                    <Button
                      variant="soft"
                      color="red"
                      onClick={handleUnlinkWallet}
                      disabled={linkingWallet}
                      className="cursor-pointer"
                    >
                      {linkingWallet ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4" />
                      )}
                      Unlink Wallet from Account
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLinkWallet}
                      disabled={linkingWallet}
                      className="cursor-pointer"
                    >
                      {linkingWallet ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LinkIcon className="w-4 h-4" />
                      )}
                      Link Wallet to Account
                    </Button>
                  )}
                </>
              ) : (
                <Flex direction="column" gap="4" align="center" className="p-6">
                  <Text size="2" color="gray" align="center">
                    Connect your wallet to link it to your account for a seamless experience.
                  </Text>
                  <ConnectButton />
                </Flex>
              )}
            </Flex>
          </Flex>
        </Card>

        {/* Notification Settings */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <Bell className="w-5 h-5 text-yellow-400" />
              <Heading size="4">Notifications</Heading>
            </Flex>
            <Separator size="4" />
            <Flex direction="column" gap="4">
              <Flex align="center" justify="between" className="p-3 rounded-lg bg-slate-800/30">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Game Matched</Text>
                  <Text size="1" color="gray">Get notified when someone joins your game</Text>
                </Flex>
                <Switch
                  checked={notifications.gameMatched}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, gameMatched: checked })
                  }
                />
              </Flex>

              <Flex align="center" justify="between" className="p-3 rounded-lg bg-slate-800/30">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Game Resolved</Text>
                  <Text size="1" color="gray">Get notified when a game is completed</Text>
                </Flex>
                <Switch
                  checked={notifications.gameResolved}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, gameResolved: checked })
                  }
                />
              </Flex>

              <Flex align="center" justify="between" className="p-3 rounded-lg bg-slate-800/30">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Email Notifications</Text>
                  <Text size="1" color="gray">Receive email updates about your games</Text>
                </Flex>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailNotifications: checked })
                  }
                />
              </Flex>

              <Flex align="center" justify="between" className="p-3 rounded-lg bg-slate-800/30">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Sound Effects</Text>
                  <Text size="1" color="gray">Play sounds for game events</Text>
                </Flex>
                <Switch
                  checked={notifications.soundEnabled}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, soundEnabled: checked })
                  }
                />
              </Flex>
            </Flex>
          </Flex>
        </Card>

        {/* Security Settings */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <Shield className="w-5 h-5 text-green-400" />
              <Heading size="4">Security</Heading>
            </Flex>
            <Separator size="4" />
            <Flex direction="column" gap="4">
              <Flex align="center" justify="between" className="p-4 rounded-lg bg-slate-800/50">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Change Password</Text>
                  <Text size="1" color="gray">Update your account password</Text>
                </Flex>
                <Button variant="soft" size="2" className="cursor-pointer">
                  Change
                </Button>
              </Flex>

              <Flex align="center" justify="between" className="p-4 rounded-lg bg-slate-800/50">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Two-Factor Authentication</Text>
                  <Text size="1" color="gray">Add an extra layer of security</Text>
                </Flex>
                <Button variant="soft" size="2" className="cursor-pointer" disabled>
                  Coming Soon
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card>

        {/* Save Button */}
        <Flex justify="end">
          <Button
            size="3"
            onClick={handleSavePreferences}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Preferences
          </Button>
        </Flex>
      </Flex>
    </DashboardLayout>
  );
}
