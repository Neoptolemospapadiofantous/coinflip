'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins } from 'lucide-react';
import { Flex, Heading, Badge, Box, Container } from '@radix-ui/themes';
import Link from 'next/link';

export function Header() {
  return (
    <Box className="glass border-b border-slate-700/50 sticky top-0 z-50">
      <Container size="4">
        <Flex align="center" justify="between" py="4">
          <Link href="/" className="no-underline">
            <Flex align="center" gap="2">
              <Box className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Coins className="w-6 h-6 text-cyan-400" />
              </Box>
              <Heading size="6" className="text-cyan-50">
                CoinFlip
              </Heading>
              <Badge color="cyan" variant="soft" radius="full">
                v1.0
              </Badge>
            </Flex>
          </Link>
          <ConnectButton />
        </Flex>
      </Container>
    </Box>
  );
}
