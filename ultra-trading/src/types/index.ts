/**
 * ULTRA Trading Platform - Core TypeScript Types
 * Comprehensive type definitions for the trading platform
 */

import type { Context } from 'hono';
import type { 
  D1Database, 
  KVNamespace, 
  R2Bucket, 
  Ai, 
  DurableObjectNamespace, 
  Fetcher 
} from '@cloudflare/workers-types';

/**
 * Cloudflare Bindings Interface
 * Defines all available Cloudflare resources
 */
export interface CloudflareBindings {
  // Database
  DB: D1Database;
  
  // Key-Value Storage
  CACHE: KVNamespace;
  
  // Object Storage
  DATA_BUCKET: R2Bucket;
  
  // AI Models
  AI: Ai;
  
  // Durable Objects
  TRADING_SESSION: DurableObjectNamespace;
  
  // Static Assets
  ASSETS: Fetcher;
  
  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  API_VERSION: string;
  
  // Secrets (injected via wrangler secret)
  ANTHROPIC_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  ALPACA_API_KEY?: string;
  ALPACA_API_SECRET?: string;
}

/**
 * Hono Context Types
 */
export type HonoContext = Context<{
  Bindings: CloudflareBindings;
  Variables: {
    userId?: string;
    tenantId?: string;
    requestId: string;
    startTime: number;
  };
}>;

export type ApiContext = {
  Bindings: CloudflareBindings;
  Variables: {
    userId?: string;
    tenantId?: string;
    requestId: string;
    startTime: number;
  };
};

/**
 * Trading Strategy Types
 */
export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  parameters: StrategyParameters;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type StrategyType = 
  | 'mean_reversion'
  | 'momentum'
  | 'pairs_trading'
  | 'options_gamma_scalping'
  | 'crypto_arbitrage'
  | 'custom';

export interface StrategyParameters {
  [key: string]: unknown;
  // Common parameters
  symbol?: string;
  timeframe?: TimeFrame;
  risk_level?: RiskLevel;
  max_position_size?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Market Data Types
 */
export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  bid?: number;
  ask?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface OptionData extends MarketData {
  strike: number;
  expiry: string;
  option_type: 'call' | 'put';
  implied_volatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

/**
 * Trading Order Types
 */
export interface TradingOrder {
  id: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: OrderType;
  quantity: number;
  price?: number;
  status: OrderStatus;
  filled_quantity?: number;
  avg_fill_price?: number;
  created_at: string;
  updated_at: string;
}

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';

/**
 * Backtest Types
 */
export interface BacktestRequest {
  strategy: TradingStrategy;
  start_date: string;
  end_date: string;
  initial_capital: number;
  symbols: string[];
  benchmark?: string | undefined;
}

export interface BacktestResult {
  id: string;
  strategy_id: string;
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  avg_trade_duration: number;
  benchmark_return?: number;
  created_at: string;
}

/**
 * User and Authentication Types
 */
export interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  role: UserRole;
  created_at: string;
  last_login?: string;
}

export type UserRole = 'admin' | 'trader' | 'viewer';

export interface AuthSession {
  user_id: string;
  tenant_id: string;
  expires_at: string;
  created_at: string;
}

/**
 * Multi-tenant Organization Types
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  settings: OrganizationSettings;
  created_at: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface OrganizationSettings {
  max_strategies: number;
  max_concurrent_trades: number;
  api_rate_limit: number;
  features: string[];
}

/**
 * API Response Types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
  execution_time_ms: number;
  version: string;
}

/**
 * Health Check Types
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: HealthCheck[];
  uptime_seconds: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration_ms: number;
  message?: string;
}

/**
 * AI Integration Types
 */
export interface AIAnalysisRequest {
  type: 'strategy_optimization' | 'market_analysis' | 'risk_assessment';
  data: Record<string, unknown>;
  model_preference?: 'claude' | 'gemini' | 'auto';
}

export interface AIAnalysisResponse {
  analysis: string;
  confidence: number;
  recommendations: string[];
  model_used: string;
  execution_time_ms: number;
}

/**
 * WebSocket Message Types
 */
export interface WebSocketMessage {
  type: 'price_update' | 'order_update' | 'strategy_signal' | 'error';
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Cache Types
 */
export interface CacheEntry<T = unknown> {
  value: T;
  expires_at: number;
  created_at: number;
}

export type CacheKey = string;
export type CacheTTL = number; // seconds

/**
 * Queue and Background Job Types
 */
export interface BackgroundJob {
  id: string;
  type: 'backtest' | 'data_sync' | 'report_generation';
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

/**
 * Configuration Types
 */
export interface AppConfig {
  api_version: string;
  environment: string;
  log_level: LogLevel;
  features: FeatureFlags;
  limits: RateLimits;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface FeatureFlags {
  real_time_trading: boolean;
  ai_analysis: boolean;
  options_trading: boolean;
  crypto_trading: boolean;
  advanced_charting: boolean;
}

export interface RateLimits {
  api_requests_per_minute: number;
  orders_per_second: number;
  backtest_concurrent_limit: number;
}