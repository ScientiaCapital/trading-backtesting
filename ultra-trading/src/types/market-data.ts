/**
 * Market Data Types
 */

export interface StockQuote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  volume: number;
  timestamp: Date;
}

export interface OptionQuote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  timestamp: Date;
}

export type { MarketData } from './strategy';