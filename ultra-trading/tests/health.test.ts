/**
 * Health Check Tests
 * Tests for basic application health and functionality
 */

import { describe, it, expect } from 'vitest';
import app from '../src/index';
import type { ExecutionContext } from '@cloudflare/workers-types';

// Mock ExecutionContext for tests
const mockContext = {
  waitUntil: (promise: Promise<any>) => void promise,
  passThroughOnException: () => void 0,
  props: {}
} as ExecutionContext;

describe('Health Check Endpoints', () => {
  it('should respond to root endpoint', async () => {
    const req = new Request('http://localhost:8787/');
    const res = await app.fetch(req, {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'error',
      API_VERSION: 'v1'
    } as any, mockContext);

    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('ULTRA Trading Platform');
    expect(json.data.status).toBe('healthy');
  });

  it('should respond to ping endpoint', async () => {
    const req = new Request('http://localhost:8787/ping');
    const res = await app.fetch(req, {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'error',
      API_VERSION: 'v1'
    } as any, mockContext);

    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.message).toBe('pong');
  });

  it('should respond to status endpoint', async () => {
    const req = new Request('http://localhost:8787/status');
    const res = await app.fetch(req, {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'error',
      API_VERSION: 'v1'
    } as any, mockContext);

    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.service).toBe('ULTRA Trading Platform');
    expect(json.data.features).toBeDefined();
    expect(json.data.limits).toBeDefined();
  });

  it('should respond to docs endpoint', async () => {
    const req = new Request('http://localhost:8787/docs');
    const res = await app.fetch(req, {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'error',
      API_VERSION: 'v1'
    } as any, mockContext);

    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe('ULTRA Trading Platform API');
    expect(json.data.endpoints).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const req = new Request('http://localhost:8787/nonexistent');
    const res = await app.fetch(req, {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'error',
      API_VERSION: 'v1'
    } as any, mockContext);

    expect(res.status).toBe(404);
    
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});