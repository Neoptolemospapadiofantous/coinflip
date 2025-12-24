'use client';

import { Flex, Text, Box, Container, Separator } from '@radix-ui/themes';
import { Github, Twitter, FileText, Shield, Coins, ExternalLink } from 'lucide-react';
import Link from 'next/link';

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

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks: FooterSection[] = [
    {
      title: 'Resources',
      links: [
        { href: '/docs', label: 'Documentation', icon: FileText },
        { href: '/admin/setup', label: 'Setup Guide', icon: Shield },
      ],
    },
    {
      title: 'Community',
      links: [
        { href: 'https://github.com', label: 'GitHub', icon: Github, external: true },
        { href: 'https://twitter.com', label: 'Twitter', icon: Twitter, external: true },
      ],
    },
  ];

  return (
    <Box className="card-solid border-t border-cyan-500/30 mt-auto">
      <Container size="4">
        <Flex direction="column" gap="6" py="8">
          {/* Main Footer Content */}
          <Flex
            direction={{ initial: 'column', sm: 'row' }}
            align={{ initial: 'start', sm: 'start' }}
            justify="between"
            gap="6"
          >
            {/* Brand Section */}
            <Flex direction="column" gap="3" style={{ maxWidth: '300px' }}>
              <Flex align="center" gap="2">
                <Box className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/50">
                  <Coins className="w-5 h-5 text-cyan-300" />
                </Box>
                <Text size="4" weight="bold" className="text-gradient-primary">
                  CoinFlip
                </Text>
              </Flex>
              <Text size="2" color="gray" className="leading-relaxed">
                Provably fair coin flip betting powered by Chainlink VRF. Built with Next.js, Wagmi, and Radix UI.
              </Text>
              <Flex gap="2" align="center">
                <Shield className="w-4 h-4 text-green-400" />
                <Text size="1" color="gray">
                  Secured by Chainlink VRF
                </Text>
              </Flex>
            </Flex>

            {/* Links Sections */}
            <Flex gap="8" className="flex-wrap">
              {footerLinks.map((section) => (
                <Flex key={section.title} direction="column" gap="3">
                  <Text size="2" weight="bold" className="text-cyan-400">
                    {section.title}
                  </Text>
                  <Flex direction="column" gap="2">
                    {section.links.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          {...(link.external && {
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          })}
                          className="no-underline group"
                        >
                          <Flex align="center" gap="2" className="hover:translate-x-1 transition-transform duration-200">
                            <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                            <Text
                              size="2"
                              color="gray"
                              className="group-hover:text-cyan-400 transition-colors"
                            >
                              {link.label}
                            </Text>
                            {link.external && (
                              <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                            )}
                          </Flex>
                        </Link>
                      );
                    })}
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Flex>

          <Separator className="bg-slate-700/50" />

          {/* Bottom Bar */}
          <Flex
            direction={{ initial: 'column', sm: 'row' }}
            align="center"
            justify="between"
            gap="3"
          >
            <Text size="1" color="gray" align="center">
              © {currentYear} CoinFlip. All rights reserved. Play responsibly. 18+
            </Text>
            <Flex gap="4" align="center" className="text-xs">
              <Link href="/terms" className="no-underline">
                <Text size="1" color="gray" className="hover:text-cyan-400 transition-colors cursor-pointer">
                  Terms
                </Text>
              </Link>
              <Text size="1" color="gray">•</Text>
              <Link href="/privacy" className="no-underline">
                <Text size="1" color="gray" className="hover:text-cyan-400 transition-colors cursor-pointer">
                  Privacy
                </Text>
              </Link>
              <Text size="1" color="gray">•</Text>
              <Link href="/responsible-gaming" className="no-underline">
                <Text size="1" color="gray" className="hover:text-cyan-400 transition-colors cursor-pointer">
                  Responsible Gaming
                </Text>
              </Link>
            </Flex>
          </Flex>

          {/* Decorative bottom glow */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        </Flex>
      </Container>
    </Box>
  );
}
