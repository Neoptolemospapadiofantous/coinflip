'use client';

import { Toaster as HotToaster } from 'react-hot-toast';
import { theme } from '@/lib/theme';

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: theme.charts.tooltip.background,
          color: '#fff',
          border: `1px solid rgba(${theme.colors.primary.rgb}, 0.3)`,
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: `0 0 20px rgba(${theme.colors.primary.rgb}, 0.2)`,
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: theme.colors.success.main,
            secondary: '#fff',
          },
          style: {
            border: `1px solid rgba(${theme.colors.success.rgb}, 0.3)`,
            boxShadow: `0 0 20px rgba(${theme.colors.success.rgb}, 0.2)`,
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: theme.colors.danger.main,
            secondary: '#fff',
          },
          style: {
            border: `1px solid rgba(${theme.colors.danger.rgb}, 0.3)`,
            boxShadow: `0 0 20px rgba(${theme.colors.danger.rgb}, 0.2)`,
          },
        },
        loading: {
          iconTheme: {
            primary: theme.colors.primary.main,
            secondary: '#fff',
          },
          style: {
            border: `1px solid rgba(${theme.colors.primary.rgb}, 0.3)`,
            boxShadow: `0 0 20px rgba(${theme.colors.primary.rgb}, 0.2)`,
          },
        },
      }}
    />
  );
}
