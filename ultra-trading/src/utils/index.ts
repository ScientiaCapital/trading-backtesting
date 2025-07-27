/**
 * ULTRA Trading Platform - Utility Functions
 * Common helper functions and utilities
 */

import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { 
  ApiResponse, 
  ApiError, 
  ResponseMeta, 
  HonoContext,
  CacheEntry,
  LogLevel
} from '../types';

/**
 * Response Helper Functions
 */
export const createApiResponse = <T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> => ({
  success: true,
  data,
  meta: {
    request_id: meta?.request_id || nanoid(),
    timestamp: new Date().toISOString(),
    execution_time_ms: meta?.execution_time_ms || 0,
    version: meta?.version || '1.0.0',
    ...meta
  }
});

export const createErrorResponse = (
  error: ApiError,
  meta?: Partial<ResponseMeta>
): ApiResponse => ({
  success: false,
  error,
  meta: {
    request_id: meta?.request_id || nanoid(),
    timestamp: new Date().toISOString(),
    execution_time_ms: meta?.execution_time_ms || 0,
    version: meta?.version || '1.0.0',
    ...meta
  }
});

/**
 * Error Helper Functions
 */
export const createError = (
  code: string,
  message: string,
  details?: Record<string, unknown> | undefined
): ApiError => ({
  code,
  message,
  details
});

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
  }
}

/**
 * Validation Helper Functions
 */
export const validateRequest = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request data', {
        errors: error.errors
      });
    }
    throw error;
  }
};

/**
 * Common Validation Schemas
 */
export const commonSchemas = {
  paginationQuery: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  dateRange: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime()
  }),

  symbol: z.string().min(1).max(10).toUpperCase(),

  strategyId: z.string().uuid(),

  tenantId: z.string().uuid()
};

/**
 * Date and Time Utilities
 */
export const formatTimestamp = (date: Date = new Date()): string => date.toISOString();

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
};

export const getMarketTimezone = (): string => 
   'America/New_York' // NYSE timezone
;

/**
 * Cache Utilities
 */
export const createCacheKey = (...parts: (string | number)[]): string => parts.join(':');

export const createCacheEntry = <T>(
  value: T,
  ttlSeconds: number
): CacheEntry<T> => {
  const now = Date.now();
  return {
    value,
    expires_at: now + (ttlSeconds * 1000),
    created_at: now
  };
};

export const isCacheEntryValid = <T>(entry: CacheEntry<T>): boolean => Date.now() < entry.expires_at;

/**
 * String Utilities
 */
export const generateRequestId = (): string => nanoid(12);

export const slugify = (text: string): string => text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Number Utilities
 */
export const roundToDecimals = (num: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export const formatCurrency = (
  amount: number,
  currency: string = 'USD'
): string => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);

export const formatPercentage = (value: number, decimals: number = 2): string => `${(value * 100).toFixed(decimals)}%`;

/**
 * Array Utilities
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    const sliced = array.slice(i, i + size);
    chunks.push(sliced);
  }
  return chunks;
};

export const unique = <T>(array: T[]): T[] => Array.from(new Set(array));

export const groupBy = <T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> => array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);

/**
 * Async Utilities
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => globalThis.setTimeout(resolve, ms));

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error = new Error('Retry failed');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      await sleep(delay * attempt); // Exponential backoff
    }
  }
  
  throw lastError;
};

export const timeout = <T>(
  promise: Promise<T>,
  ms: number
): Promise<T> => Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      globalThis.setTimeout(() => reject(new Error('Operation timed out')), ms)
    )
  ]);

/**
 * Logging Utilities
 */
export const createLogger = (context: HonoContext) => {
  const requestId = context.get('requestId') || nanoid();
  const logLevel = context.env.LOG_LEVEL as LogLevel || 'info';

  const shouldLog = (level: LogLevel): boolean => {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[logLevel];
  };

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const logEntry = {
      level,
      message,
      requestId,
      timestamp: formatTimestamp(),
      ...meta
    };

    console.log(JSON.stringify(logEntry));
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta)
  };
};

/**
 * Security Utilities
 */
export const sanitizeInput = (input: string): string => input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const generateSecureToken = (length: number = 32): string => nanoid(length);

/**
 * Trading Specific Utilities
 */
export const calculateSharpeRatio = (
  returns: number[],
  riskFreeRate: number = 0.02
): number => {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
};

export const calculateMaxDrawdown = (equity: number[]): number => {
  if (equity.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = equity[0] ?? 0;
  
  for (const value of equity) {
    if (value > peak) {
      peak = value;
    }
    
    const drawdown = (peak - value) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return maxDrawdown;
};

export const calculateWinRate = (trades: { pnl: number }[]): number => {
  if (trades.length === 0) return 0;
  
  const winningTrades = trades.filter(trade => trade.pnl > 0).length;
  return winningTrades / trades.length;
};

/**
 * Performance Monitoring
 */
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTimeMs: number }> => {
    const startTime = performance.now();
    const result = await fn();
    const executionTimeMs = performance.now() - startTime;
    return { result, executionTimeMs };
  };

export { nanoid };