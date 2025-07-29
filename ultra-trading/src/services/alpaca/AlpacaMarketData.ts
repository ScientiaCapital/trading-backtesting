/**
 * ULTRA Trading Platform - Alpaca Market Data Service
 * Real-time and historical market data from Alpaca
 */

import type { CloudflareBindings, MarketData, TimeFrame } from '../../types';
import { AlpacaClient } from './AlpacaClient';
import { AppError, createCacheKey, createCacheEntry, isCacheEntryValid } from '../../utils';

/**
 * Alpaca Bar (OHLCV) Data
 */
export interface AlpacaBar {
  t: string; // Timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  n: number; // Number of trades
  vw: number; // Volume weighted average price
}

/**
 * Alpaca Trade Data
 */
export interface AlpacaTrade {
  t: string; // Timestamp
  x: string; // Exchange
  p: number; // Price
  s: number; // Size
  c: string[]; // Conditions
  i: number; // Trade ID
  z: string; // Tape
}

/**
 * Alpaca Quote Data
 */
export interface AlpacaQuote {
  t: string; // Timestamp
  ax: string; // Ask exchange
  ap: number; // Ask price
  as: number; // Ask size
  bx: string; // Bid exchange
  bp: number; // Bid price
  bs: number; // Bid size
  c: string[]; // Conditions
  z: string; // Tape
  // Convenience properties for backward compatibility
  ask_price?: number;
  ask_size?: number;
  bid_price?: number;
  bid_size?: number;
}

/**
 * Alpaca Snapshot Data
 */
export interface AlpacaSnapshot {
  symbol: string;
  latestTrade?: AlpacaTrade;
  latestQuote?: AlpacaQuote;
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

/**
 * Market Data Request Options
 */
export interface MarketDataOptions {
  symbols: string[];
  start?: string;
  end?: string;
  limit?: number;
  pageLimit?: number;
  asof?: string;
  feed?: 'sip' | 'iex' | 'otc';
  adjustment?: 'raw' | 'split' | 'dividend' | 'all';
  timeframe?: TimeFrame;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T;
  nextPageToken?: string;
}

/**
 * Alpaca Market Data Service
 */
export class AlpacaMarketData {
  private client: AlpacaClient;
  private cache = new Map<string, any>();

  constructor(
    env: CloudflareBindings,
    requestId: string
  ) {
    this.client = new AlpacaClient(env, requestId);
  }

  /**
   * Get latest trade for a symbol
   */
  async getLatestTrade(symbol: string): Promise<AlpacaTrade | null> {
    try {
      const response = await this.client.dataRequest<{ trades: Record<string, AlpacaTrade> }>(
        `/stocks/${symbol}/trades/latest`,
        {
          queryParams: { feed: 'sip' }
        }
      );

      return response.trades[symbol] || null;
    } catch (error) {
      if ((error as AppError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get latest quote for a symbol
   */
  async getLatestQuote(symbol: string): Promise<AlpacaQuote | null> {
    try {
      const response = await this.client.dataRequest<{ quotes: Record<string, AlpacaQuote> }>(
        `/stocks/${symbol}/quotes/latest`,
        {
          queryParams: { feed: 'sip' }
        }
      );

      return response.quotes[symbol] || null;
    } catch (error) {
      if ((error as AppError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get snapshot for multiple symbols
   */
  async getSnapshots(symbols: string[]): Promise<Record<string, AlpacaSnapshot>> {
    const symbolsParam = symbols.join(',');
    
    const response = await this.client.dataRequest<Record<string, AlpacaSnapshot>>(
      '/stocks/snapshots',
      {
        queryParams: { 
          symbols: symbolsParam,
          feed: 'sip' 
        }
      }
    );

    return response;
  }

  /**
   * Get current market data for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<MarketData> {
    // Check cache first
    const cacheKey = createCacheKey('market-data', symbol);
    const cached = this.cache.get(cacheKey);
    
    if (cached && isCacheEntryValid(cached)) {
      return cached.value;
    }

    // Get snapshot data
    const snapshots = await this.getSnapshots([symbol]);
    const snapshot = snapshots[symbol];

    if (!snapshot) {
      throw new AppError('MARKET_DATA_ERROR', `No data available for symbol ${symbol}`, 404);
    }

    // Convert to MarketData format
    const marketData: MarketData = {
      symbol,
      price: snapshot.latestTrade?.p || snapshot.minuteBar?.c || 0,
      volume: snapshot.minuteBar?.v || snapshot.dailyBar?.v || 0,
      timestamp: snapshot.latestTrade?.t || new Date().toISOString(),
      ...(snapshot.latestQuote?.bp !== undefined && { bid: snapshot.latestQuote.bp }),
      ...(snapshot.latestQuote?.ap !== undefined && { ask: snapshot.latestQuote.ap }),
      ...(snapshot.dailyBar?.o !== undefined && { open: snapshot.dailyBar.o }),
      ...(snapshot.dailyBar?.h !== undefined && { high: snapshot.dailyBar.h }),
      ...(snapshot.dailyBar?.l !== undefined && { low: snapshot.dailyBar.l }),
      ...(snapshot.dailyBar?.c !== undefined && { close: snapshot.dailyBar.c })
    };

    // Cache for 1 minute
    const cacheEntry = createCacheEntry(marketData, 60);
    this.cache.set(cacheKey, cacheEntry);

    return marketData;
  }

  /**
   * Get historical bars
   */
  async getHistoricalBars(
    symbol: string,
    options: MarketDataOptions
  ): Promise<AlpacaBar[]> {
    const {
      start,
      end,
      limit = 1000,
      pageLimit,
      timeframe = '1d',
      adjustment = 'split',
      feed = 'sip'
    } = options;

    // Map our timeframe to Alpaca format
    const alpacaTimeframe = this.mapTimeframe(timeframe);

    const bars: AlpacaBar[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await this.client.dataRequest<{
        bars: Record<string, AlpacaBar[]>;
        next_page_token?: string;
      }>(
        `/stocks/${symbol}/bars`,
        {
          queryParams: {
            ...(start !== undefined && { start }),
            ...(end !== undefined && { end }),
            ...(limit !== undefined && { limit }),
            ...(pageLimit !== undefined && { page_limit: pageLimit }),
            timeframe: alpacaTimeframe,
            adjustment,
            feed,
            ...(nextPageToken !== undefined && { page_token: nextPageToken })
          }
        }
      );

      const symbolBars = response.bars[symbol] || [];
      bars.push(...symbolBars);

      nextPageToken = response.next_page_token;
    } while (nextPageToken && (!limit || bars.length < limit));

    return bars;
  }

  /**
   * Get historical trades
   */
  async getHistoricalTrades(
    symbol: string,
    options: MarketDataOptions
  ): Promise<AlpacaTrade[]> {
    const {
      start,
      end,
      limit = 1000,
      pageLimit,
      asof,
      feed = 'sip'
    } = options;

    const trades: AlpacaTrade[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await this.client.dataRequest<{
        trades: Record<string, AlpacaTrade[]>;
        next_page_token?: string;
      }>(
        `/stocks/${symbol}/trades`,
        {
          queryParams: {
            ...(start !== undefined && { start }),
            ...(end !== undefined && { end }),
            ...(limit !== undefined && { limit }),
            ...(pageLimit !== undefined && { page_limit: pageLimit }),
            ...(asof !== undefined && { asof }),
            feed,
            ...(nextPageToken !== undefined && { page_token: nextPageToken })
          }
        }
      );

      const symbolTrades = response.trades[symbol] || [];
      trades.push(...symbolTrades);

      nextPageToken = response.next_page_token;
    } while (nextPageToken && (!limit || trades.length < limit));

    return trades;
  }

  /**
   * Get historical quotes
   */
  async getHistoricalQuotes(
    symbol: string,
    options: MarketDataOptions
  ): Promise<AlpacaQuote[]> {
    const {
      start,
      end,
      limit = 1000,
      pageLimit,
      asof,
      feed = 'sip'
    } = options;

    const quotes: AlpacaQuote[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await this.client.dataRequest<{
        quotes: Record<string, AlpacaQuote[]>;
        next_page_token?: string;
      }>(
        `/stocks/${symbol}/quotes`,
        {
          queryParams: {
            ...(start !== undefined && { start }),
            ...(end !== undefined && { end }),
            ...(limit !== undefined && { limit }),
            ...(pageLimit !== undefined && { page_limit: pageLimit }),
            ...(asof !== undefined && { asof }),
            feed,
            ...(nextPageToken !== undefined && { page_token: nextPageToken })
          }
        }
      );

      const symbolQuotes = response.quotes[symbol] || [];
      quotes.push(...symbolQuotes);

      nextPageToken = response.next_page_token;
    } while (nextPageToken && (!limit || quotes.length < limit));

    return quotes;
  }

  /**
   * Convert Alpaca bar data to MarketData format
   */
  convertBarToMarketData(bar: AlpacaBar, symbol: string): MarketData {
    return {
      symbol,
      price: bar.c,
      volume: bar.v,
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c
    };
  }

  /**
   * Get historical market data in standard format
   */
  async getHistoricalData(
    symbol: string,
    startDate: string,
    endDate: string,
    timeframe: TimeFrame = '1d'
  ): Promise<MarketData[]> {
    // Check cache
    const cacheKey = createCacheKey('historical', symbol, startDate, endDate, timeframe);
    const cached = this.cache.get(cacheKey);
    
    if (cached && isCacheEntryValid(cached)) {
      return cached.value;
    }

    // Fetch historical bars
    const bars = await this.getHistoricalBars(symbol, {
      symbols: [symbol],
      start: startDate,
      end: endDate,
      timeframe
    });

    // Convert to MarketData format
    const marketData = bars.map(bar => this.convertBarToMarketData(bar, symbol));

    // Cache for 1 hour
    const cacheEntry = createCacheEntry(marketData, 3600);
    this.cache.set(cacheKey, cacheEntry);

    return marketData;
  }

  /**
   * Map internal timeframe to Alpaca format
   */
  private mapTimeframe(timeframe: TimeFrame | string): string {
    const mapping: Record<string, string> = {
      '1m': '1Min',
      '5m': '5Min',
      '15m': '15Min',
      '1h': '1Hour',
      '4h': '4Hour',
      '1d': '1Day',
      '1w': '1Week',
      '1M': '1Month'
    };

    return mapping[timeframe] || timeframe;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}