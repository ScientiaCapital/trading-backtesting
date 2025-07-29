/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Mock global objects that don't exist in test environment
beforeAll(() => {
  // Mock performance API
  if (!(global as any).performance) {
    (global as any).performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      getEntries: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => [])
    } as any;
  }

  // Mock crypto API
  if (!(global as any).crypto) {
    (global as any).crypto = {
      randomUUID: vi.fn(() => 'test-uuid-12345'),
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
      subtle: {
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        digest: vi.fn(),
        generateKey: vi.fn(),
        importKey: vi.fn(),
        exportKey: vi.fn()
      }
    } as any;
  }

  // Mock console methods to reduce test noise
  vi.spyOn(console, 'log').mockImplementation(() => { /* Mock implementation */ });
  vi.spyOn(console, 'info').mockImplementation(() => { /* Mock implementation */ });
  vi.spyOn(console, 'warn').mockImplementation(() => { /* Mock implementation */ });
  vi.spyOn(console, 'error').mockImplementation(() => { /* Mock implementation */ });
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Export test utilities
export const createMockContext = () => ({
  req: {
    url: 'http://localhost:8787/test',
    method: 'GET',
    header: vi.fn(),
    param: vi.fn(),
    query: vi.fn(),
    json: vi.fn()
  },
  env: {
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'error',
    API_VERSION: 'v1',
    DB: createMockD1(),
    CACHE: createMockKV(),
    DATA_BUCKET: createMockR2(),
    AI: createMockAI(),
    TRADING_SESSION: createMockDurableObject()
  },
  set: vi.fn(),
  get: vi.fn(),
  json: vi.fn(),
  text: vi.fn(),
  header: vi.fn()
});

export const createMockD1 = () => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(),
      all: vi.fn(() => ({ results: [] })),
      run: vi.fn()
    }))
  })),
  batch: vi.fn(),
  dump: vi.fn(),
  exec: vi.fn()
});

export const createMockKV = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
});

export const createMockR2 = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  head: vi.fn()
});

export const createMockAI = () => ({
  run: vi.fn()
});

export const createMockDurableObject = () => ({
  idFromName: vi.fn(() => 'test-do-id'),
  get: vi.fn(() => ({
    fetch: vi.fn()
  }))
});