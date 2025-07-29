/**
 * ULTRA Trading Platform - Backtesting Types
 * Types and interfaces for fastquant integration
 */

import type { AlpacaBar } from '../services/alpaca/AlpacaMarketData';

/**
 * OHLCV data format for fastquant
 */
export interface OHLCVData {
  date: (string | undefined)[];
  open: (number | undefined)[];
  high: (number | undefined)[];
  low: (number | undefined)[];
  close: (number | undefined)[];
  volume: (number | undefined)[];
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  strategy: BacktestStrategy;
  parameters?: StrategyParameters;
  initialCapital?: number;
  commission?: number;
  slippage?: number;
}

/**
 * Available backtest strategies
 */
export type BacktestStrategy = 
  | 'RSI'
  | 'MACD'
  | 'BBANDS'
  | 'SMA'
  | 'EMA'
  | 'CUSTOM'
  | 'OPENING_RANGE'
  | 'VWAP_REVERSION'
  | 'RSI_EXTREMES'
  | 'ODDTE_OPTIONS';

/**
 * Strategy parameters for different strategies
 */
export interface StrategyParameters {
  // RSI parameters
  rsi_period?: number;
  rsi_upper?: number;
  rsi_lower?: number;
  
  // MACD parameters
  fast_period?: number;
  slow_period?: number;
  signal_period?: number;
  
  // Bollinger Bands parameters
  period?: number;
  devfactor?: number;
  
  // SMA/EMA parameters
  short_period?: number;
  long_period?: number;
  
  // Custom parameters
  // Additional custom parameters can be added
  [key: string]: number | undefined;
}

/**
 * Backtest results
 */
export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: number[];
  dates: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Performance metrics from backtest
 */
export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingPeriod: number;
  finalValue: number;
  volatility?: number;
}

/**
 * Individual trade from backtest
 */
export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'long' | 'short';
  pnl: number;
  pnlPercent: number;
  holdingPeriod: number;
}

/**
 * Grid search parameters
 */
export interface GridSearchConfig {
  strategy: BacktestStrategy;
  parameterRanges: {
    [key: string]: {
      min: number;
      max: number;
      step: number;
    };
  };
  metric: 'sharpe' | 'return' | 'winRate' | 'profitFactor';
}

/**
 * Grid search results
 */
export interface GridSearchResult {
  bestParameters: Record<string, any>;
  bestMetric: number;
  allResults: Array<{
    parameters: Record<string, any>;
    metric: number;
    result: BacktestMetrics;
  }>;
}

/**
 * Multi-asset backtest configuration
 */
export interface MultiAssetBacktestConfig {
  assets: Array<{
    symbol: string;
    allocation: number;
    assetClass: 'stock' | 'crypto' | 'option';
  }>;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  startDate: string;
  endDate: string;
  initialCapital: number;
}

/**
 * Multi-asset backtest result
 */
export interface MultiAssetBacktestResult {
  portfolioMetrics: BacktestMetrics;
  assetMetrics: Record<string, BacktestMetrics>;
  correlationMatrix: number[][];
  optimalAllocation: Record<string, number>;
  rebalanceDates: string[];
}

/**
 * Backtest progress update
 */
export interface BacktestProgress {
  backtestId: string;
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds
}

/**
 * Python service request/response types
 */
export interface BacktestRequest {
  type: 'single' | 'grid' | 'multi-asset';
  config: BacktestConfig | GridSearchConfig | MultiAssetBacktestConfig;
  requestId: string;
}

export interface BacktestResponse {
  requestId: string;
  success: boolean;
  result?: BacktestResult | GridSearchResult | MultiAssetBacktestResult;
  error?: string;
}

/**
 * Data conversion utilities
 */
export interface DataConverter {
  alpacaBarsToOHLCV(bars: AlpacaBar[]): OHLCVData;
  ohlcvToDataFrame(data: OHLCVData): {
    columns: string[];
    data: Array<Record<string, string | number>>;
    index: string[];
  };
}