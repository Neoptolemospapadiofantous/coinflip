'use client';

import { Flex } from '@radix-ui/themes';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" style={{ minHeight: '100vh' }}>
      <Header />
      <Flex direction="column" style={{ flex: 1 }}>
        {children}
      </Flex>
      <Footer />
    </Flex>
  );
}
