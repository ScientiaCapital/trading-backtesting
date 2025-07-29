/**
 * Options Trading Types
 */

import type { Greeks } from '@/utils/options-pricing';

export interface OptionContract {
  id: string;
  symbol: string;
  name: string;
  status: 'active' | 'inactive';
  tradable: boolean;
  underlyingSymbol: string;
  underlyingAssetId: string;
  underlyingPrice?: number; // Current price of underlying
  type: 'call' | 'put';
  style: 'american' | 'european';
  strikePrice: number;
  expirationDate: string;
  contractSize: number;
  minTicks?: {
    aboveTick: number;
    belowTick: number;
    cutoffPrice: number;
  };
  openInterest?: number;
  openInterestDate?: string;
  volume?: number;
  lastPrice?: number; // Last traded price
}

export interface OptionChainRequest {
  underlyingSymbols: string; // Note: plural for Alpaca API
  underlyingSymbol?: string; // Singular for compatibility
  expirationDate?: string;
  type?: 'call' | 'put' | 'all';
  optionType?: 'call' | 'put';
  minStrike?: number;
  maxStrike?: number;
  minExpiration?: Date | number;
  maxExpiration?: Date | number;
  limit?: number;
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

export interface OptionPosition {
  symbol: string;
  contractType: 'call' | 'put';
  strikePrice: number;
  expirationDate: Date;
  quantity: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPL: number;
  greeks?: Greeks;
}