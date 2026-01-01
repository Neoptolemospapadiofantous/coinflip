'use client';

import React from 'react';
import { Container, Flex, Heading, Text, Button, Card, Callout } from '@radix-ui/themes';
import { devLog } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console (devLog.error handles environment-appropriate logging)
    devLog.error('Error caught by boundary:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Send to Sentry for error tracking
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container size="2" style={{ marginTop: '4rem' }}>
          <Flex direction="column" gap="6" align="center">
            <Card className="card-simple" size="4">
              <Flex direction="column" gap="5" p="6" align="center">
                <AlertTriangle className="w-16 h-16 text-red-400 animate-pulse" />

                <Heading size="6" className="text-red-400">
                  Something went wrong
                </Heading>

                <Text size="3" color="gray" align="center">
                  We encountered an unexpected error. Please try refreshing the page or
                  returning to the home page.
                </Text>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <Callout.Root color="red" size="1" style={{ width: '100%' }}>
                    <Callout.Icon>
                      <AlertTriangle className="w-4 h-4" />
                    </Callout.Icon>
                    <details style={{ flex: 1 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                        Error Details (Development Only)
                      </summary>
                      <pre style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: '200px',
                        padding: '0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px'
                      }}>
                        {this.state.error.toString()}
                        {'\n\n'}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </details>
                  </Callout.Root>
                )}

                <Flex gap="3" style={{ width: '100%' }} justify="center">
                  <Button
                    size="3"
                    variant="soft"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </Button>

                  <Link href="/">
                    <Button size="3">
                      <Home className="w-4 h-4" />
                      Go Home
                    </Button>
                  </Link>
                </Flex>
              </Flex>
            </Card>
          </Flex>
        </Container>
      );
    }

    return this.props.children;
  }
}
