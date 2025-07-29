/**
 * Test script for cron handlers
 * Simulates cron events locally
 */

import { handleScheduled } from '../src/handlers/cron';
import { CloudflareBindings } from '../src/types';

// Mock environment
const mockEnv: CloudflareBindings = {
  CACHE: {
    get: async (key: string) => {
      console.log(`KV GET: ${key}`);
      if (key === 'trading:enabled') {
        return JSON.stringify({ enabled: true });
      }
      return null;
    },
    put: async (key: string, value: string, _options?: any) => {
      console.log(`KV PUT: ${key} = ${value}`);
      return Promise.resolve();
    },
    delete: async (key: string) => {
      console.log(`KV DELETE: ${key}`);
      return Promise.resolve();
    }
  } as any,
  DB: {} as any,
  DATA_BUCKET: {} as any,
  AI: {} as any,
  AGENT_COORDINATOR: {
    idFromName: (name: string) => ({ toString: () => `mock-id-${name}` } as any),
    get: (_id: any) => ({
      fetch: async (request: Request) => {
        console.log(`Durable Object fetch: ${request.url}`);
        return new Response(JSON.stringify({ status: 'ok' }));
      }
    } as any)
  } as any,
  TRADING_SESSION: {} as any,
  REALTIME_UPDATES: {} as any,
  R2: {} as any,
  ASSETS: {} as any,
  ALPACA_KEY_ID: 'mock-key',
  ALPACA_SECRET_KEY: 'mock-secret',
  ANTHROPIC_API_KEY: 'mock-anthropic',
  GOOGLE_API_KEY: 'mock-google',
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'debug',
  API_VERSION: 'v1'
};

const mockContext: ExecutionContext = {
  waitUntil: (_promise: Promise<any>) => {
    console.log('waitUntil called');
  },
  passThroughOnException: () => {
    console.log('passThroughOnException called');
  },
  props: {} as any
};

// Test different cron patterns
async function testCronHandlers(): Promise<void> {
  console.log('🧪 Testing Cron Handlers\n');

  // Test 1: Market Open (9:30 AM)
  console.log('📍 Test 1: Market Open Handler (9:30 AM)');
  await handleScheduled({
    cron: '30 9 * * 1-5',
    scheduledTime: new Date('2025-07-28T13:30:00Z').getTime() // 9:30 AM ET
  }, mockEnv, mockContext);
  console.log('✅ Market open test complete\n');

  // Test 2: Hourly Check (10 AM)
  console.log('📍 Test 2: Hourly Check Handler (10 AM)');
  await handleScheduled({
    cron: '0 10-15 * * 1-5',
    scheduledTime: new Date('2025-07-28T14:00:00Z').getTime() // 10:00 AM ET
  }, mockEnv, mockContext);
  console.log('✅ Hourly check test complete\n');

  // Test 3: Hourly Check at 11 AM (transition time)
  console.log('📍 Test 3: Transition to Trading Mode (11 AM)');
  await handleScheduled({
    cron: '0 10-15 * * 1-5',
    scheduledTime: new Date('2025-07-28T15:00:00Z').getTime() // 11:00 AM ET
  }, mockEnv, mockContext);
  console.log('✅ Transition test complete\n');

  // Test 4: Pre-Close (3:30 PM)
  console.log('📍 Test 4: Pre-Close Handler (3:30 PM)');
  await handleScheduled({
    cron: '30 15 * * 1-5',
    scheduledTime: new Date('2025-07-28T19:30:00Z').getTime() // 3:30 PM ET
  }, mockEnv, mockContext);
  console.log('✅ Pre-close test complete\n');

  // Test 5: Market Close (4:00 PM)
  console.log('📍 Test 5: Market Close Handler (4:00 PM)');
  await handleScheduled({
    cron: '0 16 * * 1-5',
    scheduledTime: new Date('2025-07-28T20:00:00Z').getTime() // 4:00 PM ET
  }, mockEnv, mockContext);
  console.log('✅ Market close test complete\n');

  console.log('🎉 All cron handler tests completed!');
}

// Run tests
testCronHandlers().catch(console.error);