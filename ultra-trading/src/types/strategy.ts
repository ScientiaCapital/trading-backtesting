/**
 * Trading Strategy Types
 */

export type { Account } from './trading';

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: Date;
  volume?: number;
  bid?: number;
  ask?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface Signal {
  action: 'buy' | 'sell' | 'hold' | 'rebalance' | 'close' | 'roll';
  symbol: string;
  side?: 'buy' | 'sell';
  quantity?: number;
  orderType: 'market' | 'limit' | 'stop';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  limitPrice?: number;
  stopPrice?: number;
  reason: string;
  confidence: number; // 0-1
  expectedReturn?: number;
  risk?: {
    maxLoss: number;
    probability: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface RiskMetrics {
  totalExposure: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  valueAtRisk?: number;
  beta?: number;
}

export interface BacktestResult {
  strategy: string;
  period: {
    start: Date;
    end: Date;
  };
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  trades: Trade[];
}

export interface Trade {
  entryDate: Date;
  exitDate?: Date;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriod?: number;
}

export interface StrategyState {
  name: string;
  status: 'running' | 'paused' | 'stopped';
  positions: any;
  metrics: any;
  lastUpdate: Date;
}

export abstract class TradingStrategy {
  abstract name: string;
  
  abstract execute(marketData: MarketData): Promise<Signal[]>;
  abstract validate(account: any): Promise<ValidationResult>;
  
  // Optional methods
  calculateRisk?(positions: any[]): RiskMetrics;
  getState?(): StrategyState;
  onStart?(): Promise<void>;
  onStop?(): Promise<void>;
  onError?(error: Error): void;
}