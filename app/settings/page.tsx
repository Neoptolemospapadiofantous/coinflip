'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  User,
  Wallet,
  Shield,
  Mail,
  Link as LinkIcon,
  Unlink,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2,
  Music,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { soundManager } from '@/lib/sounds';
import { musicManager } from '@/lib/music';
import { useUIStore } from '@/store/uiStore';

// ─── Design tokens ─────────────────────────────────────────────────────────
const glass = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '20px',
  } as React.CSSProperties,
  row: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    padding: '12px 16px',
  } as React.CSSProperties,
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  } as React.CSSProperties,
};

// ─── Native toggle switch ──────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '999px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '3px',
        flexShrink: 0,
        background: checked ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.06)',
        transition: 'background 0.2s',
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-checked={checked}
      role="switch"
    >
      <span
        style={{
          display: 'block',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: checked ? '#06b6d4' : 'rgba(255,255,255,0.3)',
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
          transition: 'transform 0.2s, background 0.2s',
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, linkCurrentWallet, unlinkWallet, isWalletLinked } = useAuth();
  const { address, isConnected } = useAccount();
  const [saving, setSaving] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Database-backed preferences
  const {
    soundEnabled,
    skipAnimation,
    setSoundEnabled,
    setSkipAnimation,
    emailNotificationsEnabled,
    emailOnGameMatched,
    emailOnGameResolved,
    setEmailNotificationsEnabled,
    setEmailOnGameMatched,
    setEmailOnGameResolved,
  } = useUserPreferences();

  // Music from UI store
  const musicEnabled = useUIStore((state) => state.musicEnabled);
  const toggleMusic = useUIStore((state) => state.toggleMusic);

  // Sync sound/music managers with preferences
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    musicManager.setEnabled(musicEnabled);
  }, [musicEnabled]);

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Status Message */}
        {message && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            borderRadius: '12px',
            background: message.type === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${message.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          }}>
            {message.type === 'success' ? (
              <CheckCircle style={{ width: '20px', height: '20px', color: '#4ade80', flexShrink: 0 }} />
            ) : (
              <AlertCircle style={{ width: '20px', height: '20px', color: '#f87171', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '14px', color: message.type === 'success' ? '#4ade80' : '#f87171' }}>
              {message.text}
            </span>
          </div>
        )}

        {/* Account Settings */}
        <div style={glass.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Account</h2>
            </div>
            <div style={glass.divider} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="md:grid-cols-2">
              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                  <input
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.05] border border-white/10 text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                    style={{ paddingLeft: '40px' }}
                    value={user?.email || ''}
                    disabled
                    readOnly
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Email cannot be changed</span>
              </div>
              {/* Account Created */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>Account Created</label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.05] border border-white/10 text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                  value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Settings */}
        <div style={glass.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Wallet</h2>
            </div>
            <div style={glass.divider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isConnected ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Connected Wallet</span>
                      <span style={{ fontSize: '13px', color: '#22d3ee', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {address}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                      <span style={{ fontSize: '13px', color: '#4ade80' }}>Connected</span>
                    </div>
                  </div>

                  {isWalletLinked ? (
                    <button
                      onClick={handleUnlinkWallet}
                      disabled={linkingWallet}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid rgba(248,113,113,0.3)',
                        background: 'rgba(248,113,113,0.1)',
                        color: '#f87171',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: linkingWallet ? 'not-allowed' : 'pointer',
                        opacity: linkingWallet ? 0.7 : 1,
                        transition: 'background 0.2s',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {linkingWallet ? (
                        <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                      ) : (
                        <Unlink style={{ width: '16px', height: '16px' }} />
                      )}
                      Unlink Wallet from Account
                    </button>
                  ) : (
                    <button
                      onClick={handleLinkWallet}
                      disabled={linkingWallet}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: linkingWallet ? 'not-allowed' : 'pointer',
                        opacity: linkingWallet ? 0.7 : 1,
                        transition: 'opacity 0.2s',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {linkingWallet ? (
                        <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                      ) : (
                        <LinkIcon style={{ width: '16px', height: '16px' }} />
                      )}
                      Link Wallet to Account
                    </button>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                    Connect your wallet to link it to your account for a seamless experience.
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px' }}>
                    <ConnectButton />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audio & Animation Settings */}
        <div style={glass.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Audio &amp; Animation</h2>
            </div>
            <div style={glass.divider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Sound Effects */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 style={{ width: '16px', height: '16px', color: '#22d3ee' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Sound Effects</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Play sounds for game events (win, loss, match)</span>
                </div>
                <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
              </div>

              {/* Background Music */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music style={{ width: '16px', height: '16px', color: '#a78bfa' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Background Music</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Play ambient synthwave music while playing</span>
                </div>
                <Toggle checked={musicEnabled} onChange={toggleMusic} />
              </div>

              {/* Skip Animations */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap style={{ width: '16px', height: '16px', color: '#facc15' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Skip Animations</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Skip coin flip animations for faster results</span>
                </div>
                <Toggle checked={skipAnimation} onChange={setSkipAnimation} />
              </div>

            </div>
          </div>
        </div>

        {/* Email Notification Settings */}
        <div style={glass.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail style={{ width: '20px', height: '20px', color: '#facc15' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Email Notifications</h2>
            </div>
            <div style={glass.divider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Enable Email Notifications */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Enable Email Notifications</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Receive email updates about your games</span>
                </div>
                <Toggle checked={emailNotificationsEnabled} onChange={setEmailNotificationsEnabled} />
              </div>

              {/* Game Matched */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row, opacity: emailNotificationsEnabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Game Matched</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Email when someone joins your game</span>
                </div>
                <Toggle checked={emailOnGameMatched} onChange={setEmailOnGameMatched} disabled={!emailNotificationsEnabled} />
              </div>

              {/* Game Resolved */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row, opacity: emailNotificationsEnabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Game Resolved</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Email when a game is completed with results</span>
                </div>
                <Toggle checked={emailOnGameResolved} onChange={setEmailOnGameResolved} disabled={!emailNotificationsEnabled} />
              </div>

            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div style={glass.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield style={{ width: '20px', height: '20px', color: '#4ade80' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Security</h2>
            </div>
            <div style={glass.divider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Change Password */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Change Password</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Update your account password</span>
                </div>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#cbd5e1',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  Change
                </button>
              </div>

              {/* 2FA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...glass.row }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Two-Factor Authentication</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Add an extra layer of security</span>
                </div>
                <button
                  disabled
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'not-allowed',
                  }}
                >
                  Coming Soon
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? (
              <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
            ) : (
              <Save style={{ width: '16px', height: '16px' }} />
            )}
            Save Preferences
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}
