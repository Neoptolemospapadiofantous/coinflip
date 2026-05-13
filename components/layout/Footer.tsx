'use client';

import { Github, Twitter, FileText, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { LogoIcon } from '@/components/ui/LogoIcon';

interface FooterLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const FOOTER_LINKS: FooterSection[] = [
  { title: 'Resources', links: [{ href: '/docs', label: 'Documentation', icon: FileText }] },
  {
    title: 'Community',
    links: [
      { href: 'https://github.com', label: 'GitHub', icon: Github, external: true },
      { href: 'https://twitter.com', label: 'Twitter', icon: Twitter, external: true },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <div
      className="mt-auto relative"
      style={{
        background: 'rgba(5,8,22,0.9)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Main content */}
        <div className="flex flex-col sm:flex-row justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3 max-w-xs">
            <div className="flex items-center gap-2">
              <LogoIcon size={28} />
              <span
                className="text-lg font-bold"
                style={{ background: 'linear-gradient(to right, #67e8f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                CoinFlip
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Provably fair coin flip betting powered by Chainlink VRF. Built with Next.js, Wagmi, and Radix UI.
            </p>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-slate-600">Secured by Chainlink VRF</span>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-12 flex-wrap">
            {FOOTER_LINKS.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">{section.title}</p>
                <div className="flex flex-col gap-2">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        {...(link.external && { target: '_blank', rel: 'noopener noreferrer' })}
                        className="no-underline flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 group transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 group-hover:text-cyan-400 transition-colors" />
                        {link.label}
                        {link.external && <ExternalLink className="w-3 h-3 opacity-50" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-700">© {currentYear} CoinFlip. All rights reserved. Play responsibly. 18+</p>
          <div className="flex items-center gap-4 text-xs">
            {['Terms', 'Privacy', 'Responsible Gaming'].map((label, i) => (
              <span key={label} className="flex items-center gap-4">
                {i > 0 && <span className="text-slate-800">•</span>}
                <Link href={`/${label.toLowerCase().replace(' ', '-')}`} className="no-underline text-slate-600 hover:text-cyan-400 transition-colors">
                  {label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(6,182,212,0.3), rgba(168,85,247,0.3), transparent)' }} />
    </div>
  );
}
