'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#fff',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#22c55e',
            secondary: '#fff',
          },
          style: {
            border: '1px solid rgba(34, 197, 94, 0.3)',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          style: {
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
          },
        },
        loading: {
          iconTheme: {
            primary: '#06b6d4',
            secondary: '#fff',
          },
          style: {
            border: '1px solid rgba(6, 182, 212, 0.3)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
          },
        },
      }}
    />
  );
}
