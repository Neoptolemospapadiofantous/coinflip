/**
 * Error Handling Utilities
 *
 * Provides user-friendly error messages and error parsing
 */

export type ErrorType =
  | 'wallet_connection'
  | 'transaction_rejected'
  | 'insufficient_funds'
  | 'network_error'
  | 'contract_error'
  | 'api_error'
  | 'unknown';

export interface ParsedError {
  type: ErrorType;
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse error and return user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  // Handle null/undefined
  if (!error) {
    return {
      type: 'unknown',
      title: 'Unknown Error',
      message: 'An unexpected error occurred',
      suggestion: 'Please try again',
    };
  }

  const err = error as any;
  const errorMessage = err?.message || err?.toString() || 'Unknown error';

  // User rejected transaction
  if (
    errorMessage.includes('User rejected') ||
    errorMessage.includes('User denied') ||
    errorMessage.includes('user rejected') ||
    err?.code === 4001 ||
    err?.code === 'ACTION_REJECTED'
  ) {
    return {
      type: 'transaction_rejected',
      title: 'Transaction Rejected',
      message: 'You cancelled the transaction in your wallet',
      suggestion: 'Try again when you\'re ready to confirm',
    };
  }

  // Insufficient funds
  if (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient balance') ||
    errorMessage.includes('exceeds balance')
  ) {
    return {
      type: 'insufficient_funds',
      title: 'Insufficient Funds',
      message: 'You don\'t have enough funds to complete this transaction',
      suggestion: 'Add more funds to your wallet or try a smaller amount',
    };
  }

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    err?.code === 'NETWORK_ERROR'
  ) {
    return {
      type: 'network_error',
      title: 'Network Error',
      message: 'Failed to connect to the blockchain network',
      suggestion: 'Check your internet connection and try again',
    };
  }

  // Wallet connection errors
  if (
    errorMessage.includes('No provider') ||
    errorMessage.includes('wallet') ||
    errorMessage.includes('MetaMask') ||
    errorMessage.includes('extension not found')
  ) {
    return {
      type: 'wallet_connection',
      title: 'Wallet Connection Failed',
      message: 'Could not connect to your wallet',
      suggestion: 'Make sure MetaMask or another Web3 wallet is installed and unlocked',
    };
  }

  // Contract-specific errors
  if (
    errorMessage.includes('execution reverted') ||
    errorMessage.includes('revert')
  ) {
    // Try to extract the revert reason
    const revertMatch = errorMessage.match(/reverted with reason string '(.+?)'/);
    const revertReason = revertMatch ? revertMatch[1] : 'Transaction failed';

    return {
      type: 'contract_error',
      title: 'Transaction Failed',
      message: revertReason,
      suggestion: 'Check the transaction details and try again',
    };
  }

  // API errors
  if (err?.status || err?.statusCode) {
    const status = err.status || err.statusCode;

    if (status === 404) {
      return {
        type: 'api_error',
        title: 'Not Found',
        message: 'The requested resource was not found',
        suggestion: 'The item may have been removed or doesn\'t exist',
      };
    }

    if (status === 429) {
      return {
        type: 'api_error',
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly',
        suggestion: 'Please wait a moment and try again',
      };
    }

    if (status >= 500) {
      return {
        type: 'api_error',
        title: 'Server Error',
        message: 'The server encountered an error',
        suggestion: 'Please try again in a few moments',
      };
    }
  }

  // Generic fallback
  return {
    type: 'unknown',
    title: 'Error',
    message: errorMessage.slice(0, 200), // Limit message length
    suggestion: 'If this persists, please contact support',
  };
}

/**
 * Format error for display
 */
export function formatErrorMessage(error: unknown): string {
  const parsed = parseError(error);
  return `${parsed.title}: ${parsed.message}`;
}

/**
 * Check if error is user-initiated (e.g., rejected transaction)
 */
export function isUserError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.type === 'transaction_rejected';
}

/**
 * Log error appropriately based on environment
 */
export function logError(error: unknown, context?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'Error'}]`, error);
  } else {
    // In production, you might want to send to an error tracking service
    // Example: Sentry.captureException(error);
    console.warn('Error occurred:', formatErrorMessage(error));
  }
}

/**
 * Error toast helper with automatic error parsing
 */
export function getErrorToast(error: unknown) {
  const parsed = parseError(error);

  return {
    title: parsed.title,
    description: parsed.message,
    variant: 'destructive' as const,
    duration: isUserError(error) ? 3000 : 5000,
  };
}
