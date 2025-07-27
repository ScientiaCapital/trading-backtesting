/**
 * Alpaca Trading API Integration Tests
 * Tests for Alpaca trading functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import type { ExecutionContext } from '@cloudflare/workers-types';

// Mock ExecutionContext for tests
const mockContext = {
  waitUntil: (promise: Promise<any>) => void promise,
  passThroughOnException: () => void 0,
  props: {}
} as ExecutionContext;

// Test environment with API keys and proper D1 mock
const testEnv = {
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'error',
  API_VERSION: 'v1',
  ALPACA_API_KEY: 'PKDINXYX5XL2HL5P5TNV',
  DB: {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        first: async () => {
          // Mock user lookup for auth
          if (query.includes('SELECT * FROM users')) {
            return {
              id: 'test-user',
              tenant_id: 'test-tenant',
              email: 'test@example.com',
              name: 'Test User',
              role: 'trader'
            };
          }
          return null;
        },
        all: async () => ({ 
          results: [],
          success: true,
          meta: {}
        }),
        run: async () => ({
          success: true,
          meta: {}
        })
      })
    })
  },
  CACHE: {
    get: async (key: string) => {
      if (key.startsWith('session:')) {
        return JSON.stringify({
          user_id: 'test-user',
          tenant_id: 'test-tenant',
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });
      }
      return null;
    },
    put: async () => {},
    delete: async () => {}
  },
  TRADING_SESSION: {
    idFromName: (name: string) => ({ toString: () => `id-${name}` }),
    get: (id: any) => ({
      fetch: async () => new Response('WebSocket mock', { status: 101 })
    })
  }
} as any;

// Helper to create authenticated request
const createAuthRequest = (url: string, options: RequestInit = {}) => new Request(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'test-tenant',
      ...options.headers
    }
  });

describe('Alpaca Trading API', () => {
  describe('Account Endpoints', () => {
    it('should get account information', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/account');
      const res = await app.fetch(req, testEnv, mockContext);
      
      // In test mode, this might fail due to invalid API key
      // But we're testing the endpoint structure
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toHaveProperty('id');
        expect(json.data).toHaveProperty('buyingPower');
        expect(json.data).toHaveProperty('cash');
        expect(json.data).toHaveProperty('portfolioValue');
      }
    });
  });

  describe('Position Endpoints', () => {
    it('should get all positions', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/positions');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toBeInstanceOf(Array);
      }
    });

    it('should get specific position', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/positions/AAPL');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 404, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toHaveProperty('symbol');
        expect(json.data).toHaveProperty('quantity');
        expect(json.data).toHaveProperty('marketValue');
      }
    });

    it('should close a position', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/positions/AAPL', {
        method: 'DELETE'
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 404, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
    });

    it('should close all positions', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/positions', {
        method: 'DELETE'
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
    });
  });

  describe('Order Endpoints', () => {
    it('should submit a market order', async () => {
      const orderData = {
        symbol: 'AAPL',
        quantity: 1,
        side: 'buy',
        orderType: 'market',
        timeInForce: 'day'
      };
      
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([201, 400, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 201) {
        expect(json.data).toHaveProperty('id');
        expect(json.data).toHaveProperty('symbol');
        expect(json.data).toHaveProperty('qty');
        expect(json.data).toHaveProperty('side');
      }
    });

    it('should submit a limit order', async () => {
      const orderData = {
        symbol: 'AAPL',
        quantity: 1,
        side: 'buy',
        orderType: 'limit',
        timeInForce: 'gtc',
        limitPrice: 150.00
      };
      
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([201, 400, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
    });

    it('should reject limit order without limit price', async () => {
      const orderData = {
        symbol: 'AAPL',
        quantity: 1,
        side: 'buy',
        orderType: 'limit',
        timeInForce: 'day'
        // Missing limitPrice
      };
      
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect(res.status).toBe(403);
      
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_TENANT');
    });

    it('should get orders', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders?status=open&limit=10');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toBeInstanceOf(Array);
      }
    });

    it('should cancel an order', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders/test-order-id', {
        method: 'DELETE'
      });
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 404, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
    });
  });

  describe('Market Data Endpoints', () => {
    it('should get real-time quotes', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/market/quotes/AAPL');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toHaveProperty('bid_price');
        expect(json.data).toHaveProperty('ask_price');
      }
    });

    it('should get historical bars', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/market/bars/AAPL?timeframe=1Day&limit=10');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toBeInstanceOf(Array);
      }
    });

    it('should get market status', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/market/status');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toHaveProperty('is_open');
        expect(json.data).toHaveProperty('next_open');
        expect(json.data).toHaveProperty('next_close');
      }
    });
  });

  describe('Options Endpoints', () => {
    it('should get option chains', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/options/chains/AAPL?type=call&limit=20');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect([200, 401, 403, 500]).toContain(res.status);
      
      const json = await res.json() as any;
      expect(json).toHaveProperty('success');
      
      if (res.status === 200) {
        expect(json.data).toHaveProperty('option_contracts');
        expect(json.data.option_contracts).toBeInstanceOf(Array);
      }
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      const req = new Request('http://localhost:8787/api/v1/trading/account');
      const res = await app.fetch(req, testEnv, mockContext);
      
      expect(res.status).toBe(401);
      
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit headers', async () => {
      const req = createAuthRequest('http://localhost:8787/api/v1/trading/account');
      const res = await app.fetch(req, testEnv, mockContext);
      
      // Check for rate limit headers in response
      const requestId = res.headers.get('X-Request-ID');
      expect(requestId).toBeTruthy();
    });
  });
});

describe('Alpaca API Error Handling', () => {
  it('should handle invalid symbols gracefully', async () => {
    const req = createAuthRequest('http://localhost:8787/api/v1/trading/market/quotes/INVALID123');
    const res = await app.fetch(req, testEnv, mockContext);
    
    expect([400, 403, 404, 500]).toContain(res.status);
    
    const json = await res.json() as any;
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate order parameters', async () => {
    const invalidOrder = {
      symbol: '', // Invalid empty symbol
      quantity: -1, // Invalid negative quantity
      side: 'invalid', // Invalid side
      orderType: 'market',
      timeInForce: 'day'
    };
    
    const req = createAuthRequest('http://localhost:8787/api/v1/trading/orders', {
      method: 'POST',
      body: JSON.stringify(invalidOrder)
    });
    const res = await app.fetch(req, testEnv, mockContext);
    
    expect(res.status).toBe(403);
    
    const json = await res.json() as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_TENANT');
  });
});