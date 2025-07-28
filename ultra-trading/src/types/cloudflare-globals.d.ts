/**
 * Cloudflare Workers Global Type Definitions
 * Extends the built-in Cloudflare Workers types with missing definitions
 */

/// <reference types="@cloudflare/workers-types" />

declare global {
  // WebSocket types
  interface WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }
  
  const WebSocketPair: {
    new(): WebSocketPair;
  };

  // Durable Object types
  interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
    id: DurableObjectId;
    name?: string;
  }

  // Scheduled Event type
  interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    noRetry(): void;
  }

  // Node.js compatibility types (for scripts and tests)
  namespace NodeJS {
    interface Timeout {
      ref(): this;
      unref(): this;
      hasRef(): boolean;
      refresh(): this;
      [Symbol.toPrimitive](): number;
    }
  }
}

// Make this a module
export {};