'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown } from 'lucide-react';

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              // Not connected - show connect button
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    className="hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] group"
                  >
                    <Wallet style={{ width: '20px', height: '20px', color: '#e0f2fe' }} />
                    <span style={{ fontWeight: 500, color: '#e0f2fe' }}>
                      Connect
                    </span>
                  </button>
                );
              }

              // Wrong network
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: 'rgba(239,68,68,0.2)',
                      border: '1px solid rgba(239,68,68,0.5)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    className="animate-pulse"
                  >
                    <span style={{ color: '#fca5a5', fontWeight: 500 }}>Wrong Network</span>
                    <ChevronDown style={{ width: '16px', height: '16px', color: '#fca5a5' }} />
                  </button>
                );
              }

              // Connected - show wallet info
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Chain Button */}
                  <button
                    onClick={openChainModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    className="hover:border-cyan-500/50"
                    title={chain.name}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name ?? 'Chain'}
                        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                      />
                    )}
                    <ChevronDown style={{ width: '12px', height: '12px', color: 'rgba(156,163,175,1)' }} />
                  </button>

                  {/* Account Button */}
                  <button
                    onClick={openAccountModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                    className="hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] group"
                  >
                    {/* Balance */}
                    {account.balanceFormatted && (
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(209,213,219,1)' }} className="group-hover:text-cyan-300">
                        {parseFloat(account.balanceFormatted).toFixed(3)} {account.balanceSymbol}
                      </span>
                    )}

                    {/* Divider */}
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

                    {/* Address with Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {account.ensAvatar ? (
                        <img
                          src={account.ensAvatar}
                          alt="ENS Avatar"
                          style={{ width: '24px', height: '24px', borderRadius: '50%', outline: '2px solid rgba(6,182,212,0.3)' }}
                        />
                      ) : (
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                          outline: '2px solid rgba(6,182,212,0.3)',
                        }} />
                      )}
                      <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'rgba(209,213,219,1)' }} className="group-hover:text-white">
                        {account.ensName || `${account.address.slice(0, 4)}...${account.address.slice(-4)}`}
                      </span>
                    </div>

                    <ChevronDown style={{ width: '16px', height: '16px', color: 'rgba(156,163,175,1)' }} className="group-hover:text-cyan-400" />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
