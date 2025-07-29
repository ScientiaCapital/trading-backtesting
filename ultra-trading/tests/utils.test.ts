/**
 * Utility Functions Tests
 * Tests for common utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  createApiResponse,
  createErrorResponse,
  createError,
  formatTimestamp,
  addDays,
  isBusinessDay,
  createCacheKey,
  createCacheEntry,
  isCacheEntryValid,
  slugify,
  roundToDecimals,
  formatCurrency,
  formatPercentage,
  chunk,
  unique,
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateWinRate
} from '../src/utils';

describe('Response Utilities', () => {
  it('should create API response', () => {
    const response = createApiResponse({ test: 'data' });
    
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ test: 'data' });
    expect(response.meta).toBeDefined();
    expect(response.meta?.request_id).toBeDefined();
    expect(response.meta?.timestamp).toBeDefined();
  });

  it('should create error response', () => {
    const error = createError('TEST_ERROR', 'Test error message');
    const response = createErrorResponse(error);
    
    expect(response.success).toBe(false);
    expect(response.error).toEqual(error);
    expect(response.meta).toBeDefined();
  });
});

describe('Date Utilities', () => {
  it('should format timestamp', () => {
    const date = new Date('2024-01-01T12:00:00.000Z');
    const formatted = formatTimestamp(date);
    
    expect(formatted).toBe('2024-01-01T12:00:00.000Z');
  });

  it('should add days to date', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const newDate = addDays(date, 5);
    
    expect(newDate.getUTCDate()).toBe(6);
  });

  it('should identify business days', () => {
    const monday = new Date('2024-01-01T12:00:00.000Z'); // Monday
    const saturday = new Date('2024-01-06T12:00:00.000Z'); // Saturday
    const sunday = new Date('2024-01-07T12:00:00.000Z'); // Sunday
    
    expect(isBusinessDay(monday)).toBe(true);
    expect(isBusinessDay(saturday)).toBe(false);
    expect(isBusinessDay(sunday)).toBe(false);
  });
});

describe('Cache Utilities', () => {
  it('should create cache key', () => {
    const key = createCacheKey('user', 123, 'data');
    expect(key).toBe('user:123:data');
  });

  it('should create cache entry', () => {
    const value = { test: 'data' };
    const entry = createCacheEntry(value, 300);
    
    expect(entry.value).toEqual(value);
    expect(entry.expires_at).toBeGreaterThan(Date.now());
    expect(entry.created_at).toBeLessThanOrEqual(Date.now());
  });

  it('should validate cache entry', () => {
    const validEntry = createCacheEntry('test', 300);
    const expiredEntry = {
      value: 'test',
      expires_at: Date.now() - 1000,
      created_at: Date.now() - 2000
    };
    
    expect(isCacheEntryValid(validEntry)).toBe(true);
    expect(isCacheEntryValid(expiredEntry)).toBe(false);
  });
});

describe('String Utilities', () => {
  it('should slugify text', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('Test_String-123')).toBe('test-string-123');
    expect(slugify('  Spaced  Out  ')).toBe('spaced-out');
  });
});

describe('Number Utilities', () => {
  it('should round to decimals', () => {
    expect(roundToDecimals(3.14159, 2)).toBe(3.14);
    expect(roundToDecimals(2.5, 0)).toBe(3);
  });

  it('should format currency', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toMatch(/\$1,234\.56/);
  });

  it('should format percentage', () => {
    expect(formatPercentage(0.1234, 2)).toBe('12.34%');
    expect(formatPercentage(0.5, 1)).toBe('50.0%');
  });
});

describe('Array Utilities', () => {
  it('should chunk arrays', () => {
    const array = [1, 2, 3, 4, 5, 6, 7];
    const chunks = chunk(array, 3);
    
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('should get unique values', () => {
    const array = [1, 2, 2, 3, 3, 3, 4];
    const uniqueValues = unique(array);
    
    expect(uniqueValues).toEqual([1, 2, 3, 4]);
  });
});

describe('Trading Utilities', () => {
  it('should calculate Sharpe ratio', () => {
    const returns = [0.1, 0.05, -0.02, 0.08, 0.03];
    const sharpe = calculateSharpeRatio(returns, 0.02);
    
    expect(sharpe).toBeGreaterThan(0);
    expect(typeof sharpe).toBe('number');
  });

  it('should calculate max drawdown', () => {
    const equity = [100, 110, 105, 120, 90, 95, 100];
    const maxDrawdown = calculateMaxDrawdown(equity);
    
    expect(maxDrawdown).toBeCloseTo(0.25); // 25% drawdown from 120 to 90
  });

  it('should calculate win rate', () => {
    const trades = [
      { pnl: 100 },
      { pnl: -50 },
      { pnl: 75 },
      { pnl: -25 },
      { pnl: 200 }
    ];
    const winRate = calculateWinRate(trades);
    
    expect(winRate).toBe(0.6); // 3 out of 5 winning trades
  });

  it('should handle empty arrays in trading calculations', () => {
    expect(calculateSharpeRatio([])).toBe(0);
    expect(calculateMaxDrawdown([])).toBe(0);
    expect(calculateWinRate([])).toBe(0);
  });
});