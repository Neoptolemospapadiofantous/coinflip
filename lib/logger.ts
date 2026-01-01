import pino from 'pino';

// Determine log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

// Base logger configuration
const baseOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
  // Format log messages
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}), // Remove pid and hostname for cleaner logs
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'secret',
      'token',
      'apiKey',
      'privateKey',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
};

// Create logger with pretty printing in development
const logger = pino(
  process.env.NODE_ENV === 'development'
    ? {
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : baseOptions
);

// Child loggers for different modules
export const apiLogger = logger.child({ module: 'api' });
export const dbLogger = logger.child({ module: 'db' });
export const wsLogger = logger.child({ module: 'websocket' });
export const authLogger = logger.child({ module: 'auth' });
export const indexerLogger = logger.child({ module: 'indexer' });
export const gameLogger = logger.child({ module: 'game' });

// Request logger middleware helper
export function logRequest(method: string, path: string, duration: number, status: number) {
  const logData = {
    method,
    path,
    duration_ms: duration,
    status,
  };

  if (status >= 500) {
    apiLogger.error(logData, 'Request failed');
  } else if (status >= 400) {
    apiLogger.warn(logData, 'Request error');
  } else {
    apiLogger.info(logData, 'Request completed');
  }
}

// Error logger with context
export function logError(
  error: Error | unknown,
  context: Record<string, unknown> = {},
  module: string = 'app'
) {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { error: String(error) };

  logger.child({ module }).error({ ...errorInfo, ...context }, 'Error occurred');
}

// Performance logger
export function logPerformance(
  operation: string,
  duration: number,
  metadata: Record<string, unknown> = {}
) {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  logger[level]({ operation, duration_ms: duration, ...metadata }, 'Performance metric');
}

// Audit logger for security-sensitive operations
export function logAudit(
  action: string,
  userId: string | null,
  details: Record<string, unknown> = {}
) {
  authLogger.info(
    {
      action,
      userId: userId || 'anonymous',
      ...details,
      timestamp: new Date().toISOString(),
    },
    'Audit event'
  );
}

export default logger;
