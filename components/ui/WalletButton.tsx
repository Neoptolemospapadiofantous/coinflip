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
                    className="
                      flex items-center gap-2 px-4 py-2.5
                      bg-gradient-to-r from-cyan-500/20 to-purple-500/20
                      hover:from-cyan-500/30 hover:to-purple-500/30
                      border border-cyan-500/50 hover:border-cyan-400
                      rounded-xl transition-all duration-300
                      hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]
                      group
                    "
                  >
                    <Wallet className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
                    <span className="font-medium text-cyan-300 group-hover:text-cyan-200">
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
                    className="
                      flex items-center gap-2 px-4 py-2.5
                      bg-red-500/20 hover:bg-red-500/30
                      border border-red-500/50 hover:border-red-400
                      rounded-xl transition-all duration-300
                      animate-pulse
                    "
                  >
                    <span className="text-red-400 font-medium">Wrong Network</span>
                    <ChevronDown className="w-4 h-4 text-red-400" />
                  </button>
                );
              }

              // Connected - show wallet info
              return (
                <div className="flex items-center gap-2">
                  {/* Chain Button */}
                  <button
                    onClick={openChainModal}
                    className="
                      flex items-center gap-1.5 px-3 py-2
                      bg-slate-800/80 hover:bg-slate-700/80
                      border border-slate-600/50 hover:border-cyan-500/50
                      rounded-xl transition-all duration-300
                      group
                    "
                    title={chain.name}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name ?? 'Chain'}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-cyan-400" />
                  </button>

                  {/* Account Button */}
                  <button
                    onClick={openAccountModal}
                    className="
                      flex items-center gap-3 px-3 py-2
                      bg-gradient-to-r from-slate-800/90 to-slate-800/70
                      hover:from-cyan-500/20 hover:to-purple-500/20
                      border border-slate-600/50 hover:border-cyan-500/50
                      rounded-xl transition-all duration-300
                      hover:shadow-[0_0_15px_rgba(0,255,255,0.2)]
                      group
                    "
                  >
                    {/* Balance */}
                    {account.balanceFormatted && (
                      <span className="text-sm font-medium text-slate-300 group-hover:text-cyan-300">
                        {parseFloat(account.balanceFormatted).toFixed(3)} {account.balanceSymbol}
                      </span>
                    )}

                    {/* Divider */}
                    <div className="w-px h-5 bg-slate-600/50" />

                    {/* Address with Avatar */}
                    <div className="flex items-center gap-2">
                      {account.ensAvatar ? (
                        <img
                          src={account.ensAvatar}
                          alt="ENS Avatar"
                          className="w-6 h-6 rounded-full ring-2 ring-cyan-500/30"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 ring-2 ring-cyan-500/30" />
                      )}
                      <span className="text-sm font-mono text-slate-300 group-hover:text-white">
                        {account.ensName || `${account.address.slice(0, 4)}...${account.address.slice(-4)}`}
                      </span>
                    </div>

                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
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
