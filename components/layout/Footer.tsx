'use client';

import { Flex, Text, Box, Container } from '@radix-ui/themes';
import { Github, Twitter, FileText } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <Box className="glass border-t border-slate-700/50">
      <Container size="4">
        <Flex direction="column" gap="4" py="6">
          <Flex align="center" justify="between" wrap="wrap" gap="4">
            <Text size="2" color="gray">
              Built with Next.js, wagmi, Radix UI & Chainlink VRF
            </Text>
            <Flex gap="4" align="center">
              <Link
                href="/docs"
                className="no-underline flex items-center gap-1 hover:text-cyan-400 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <Text size="2" color="gray" className="hover:text-cyan-400">
                  Docs
                </Text>
              </Link>
              <Link
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline flex items-center gap-1 hover:text-cyan-400 transition-colors"
              >
                <Github className="w-4 h-4" />
                <Text size="2" color="gray" className="hover:text-cyan-400">
                  GitHub
                </Text>
              </Link>
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline flex items-center gap-1 hover:text-cyan-400 transition-colors"
              >
                <Twitter className="w-4 h-4" />
                <Text size="2" color="gray" className="hover:text-cyan-400">
                  Twitter
                </Text>
              </Link>
            </Flex>
          </Flex>
          <Text size="1" color="gray" align="center">
            © 2025 CoinFlip. All rights reserved. Play responsibly.
          </Text>
        </Flex>
      </Container>
    </Box>
  );
}
