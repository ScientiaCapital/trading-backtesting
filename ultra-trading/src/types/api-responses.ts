/**
 * API Response Type Definitions
 * Following Hono best practices for typed responses
 */

import type { BacktestResult, MarketData } from './index';
import type { AgentMessage } from './agents';

/**
 * Health Check Response Types
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, ServiceStatus>;
  uptime_seconds?: number;
}

export interface ServiceStatus {
  status: 'pass' | 'fail' | 'warn';
  latency_ms?: number;
  message?: string;
}

/**
 * Agent Decision Types
 */
export interface AgentDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  score?: number;
  symbol?: string;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Trading Platform Response Types
 */
export interface DashboardStatusResponse {
  success: boolean;
  environment: string;
  timestamp: string;
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
    ai: ServiceStatus;
    alpaca: ServiceStatus;
    agents: ServiceStatus;
  };
  config?: {
    enableRealTimeTrading?: boolean;
    enableAIAgents?: boolean;
  };
}

/**
 * Backtest Response Types
 */
export interface BacktestData {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: BacktestResult;
  progress?: number;
  error?: string;
}

export interface BacktestStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: BacktestResult;
  error?: string;
}

/**
 * Market Data Response Types
 */
export interface MarketDataResponse {
  data: MarketData | MarketData[];
  timestamp: string;
}

/**
 * Agent Response Types
 */
export interface AgentIterationResult {
  iteration: number;
  processingTime: number;
  decision: AgentDecision;
  confidence: number;
}

export interface AgentTestResponse {
  success: boolean;
  agentResults: Record<string, {
    response?: string;
    error?: string;
    processingTime: number;
  }>;
  teamDecision?: {
    decision: AgentDecision;
    confidence: number;
    consensus: boolean;
  };
  iterations?: AgentIterationResult[];
}

/**
 * WebSocket Message Types
 */
export interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'message' | 'ping' | 'pong';
  data?: unknown;
  channel?: string;
  timestamp?: string;
}

/**
 * Platform Status Types
 */
export interface PlatformStatus {
  status: string;
  timestamp: string;
  data?: {
    agents: Record<string, unknown>;
    services: Record<string, unknown>;
  };
}

/**
 * Type Guards
 */
export function isAgentMessage(data: unknown): data is AgentMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'payload' in data
  );
}

export function isAgentDecision(data: unknown): data is AgentDecision {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    'confidence' in data &&
    'reasoning' in data
  );
}

export function isBacktestData(data: unknown): data is BacktestData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'status' in data
  );
}

export function isMarketData(data: unknown): data is MarketData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'symbol' in data &&
    'price' in data &&
    'timestamp' in data
  );
}

/**
 * Extend Hono's ContextVariableMap for type safety
 */
declare module 'hono' {
  interface ContextVariableMap {
    decision?: AgentDecision;
    marketData?: MarketData;
    backtestData?: BacktestData;
  }
}