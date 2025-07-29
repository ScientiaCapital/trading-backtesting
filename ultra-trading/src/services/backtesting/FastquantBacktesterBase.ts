/**
 * ULTRA Trading Platform - Fastquant Backtester Base
 * Base class for all backtesting services
 */

import type { CloudflareBindings } from '../../types';
import type { 
  BacktestConfig, 
  BacktestResult, 
  BacktestRequest,
  BacktestResponse,
  BacktestProgress,
  OHLCVData
} from '../../types/backtesting';
import { AlpacaMarketData } from '../alpaca/AlpacaMarketData';
import { BacktestDataConverter } from './BacktestDataConverter';
import { AppError } from '../../utils';

/**
 * Abstract base class for fastquant backtesting
 */
export abstract class FastquantBacktesterBase {
  protected env: CloudflareBindings;
  protected requestId: string;
  protected marketData: AlpacaMarketData;
  protected dataConverter: BacktestDataConverter;
  
  constructor(env: CloudflareBindings, requestId: string) {
    this.env = env;
    this.requestId = requestId;
    this.marketData = new AlpacaMarketData(env, requestId);
    this.dataConverter = new BacktestDataConverter();
  }

  /**
   * Execute a backtest
   */
  abstract execute(config: BacktestConfig): Promise<BacktestResult>;

  /**
   * Get historical data for backtesting
   */
  protected async getHistoricalData(
    symbol: string,
    startDate: string,
    endDate: string,
    timeframe: string = '1d'
  ): Promise<OHLCVData> {
    try {
      // Check cache first
      const cacheKey = `backtest:data:${symbol}:${startDate}:${endDate}:${timeframe}`;
      const cached = await this.env.CACHE.get(cacheKey, 'json') as OHLCVData | null;
      
      if (cached) {
        console.log(`[${this.requestId}] Using cached data for ${symbol}`);
        return cached;
      }

      // Fetch from Alpaca
      console.log(`[${this.requestId}] Fetching ${symbol} data from ${startDate} to ${endDate}`);
      
      const bars = await this.marketData.getHistoricalBars(symbol, {
        symbols: [symbol],
        start: startDate,
        end: endDate,
        timeframe: timeframe as any,
        adjustment: 'all' // Include splits and dividends
      });

      if (bars.length === 0) {
        throw new AppError(
          'NO_DATA',
          `No historical data available for ${symbol} in the specified date range`,
          404
        );
      }

      // Convert to OHLCV format
      const ohlcvData = timeframe.includes('m') || timeframe.includes('h')
        ? this.dataConverter.convertIntradayBars(bars)
        : this.dataConverter.alpacaBarsToOHLCV(bars);

      // Validate data
      const validation = this.dataConverter.validateData(ohlcvData);
      if (!validation.valid) {
        throw new AppError(
          'INVALID_DATA',
          `Data validation failed: ${validation.errors.join(', ')}`,
          400
        );
      }

      // Cache for 5 minutes
      await this.env.CACHE.put(cacheKey, JSON.stringify(ohlcvData), {
        expirationTtl: 300
      });

      console.log(`[${this.requestId}] Retrieved ${bars.length} bars for ${symbol}`);
      return ohlcvData;
    } catch (error) {
      console.error(`[${this.requestId}] Failed to get historical data:`, error);
      throw error;
    }
  }

  /**
   * Execute Python backtest subprocess
   */
  protected async executePythonBacktest(request: BacktestRequest): Promise<BacktestResponse> {
    const pythonServiceUrl = this.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
    
    try {
      console.log(`[${this.requestId}] Sending backtest request to Python service`);
      
      const response = await fetch(`${pythonServiceUrl}/backtest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.requestId
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AppError(
          'PYTHON_SERVICE_ERROR',
          `Python service error: ${error}`,
          response.status
        );
      }

      const result = await response.json() as BacktestResponse;
      
      if (!result.success) {
        throw new AppError(
          'BACKTEST_FAILED',
          result.error || 'Backtest execution failed',
          500
        );
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      console.error(`[${this.requestId}] Python service communication error:`, error);
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        'Python backtesting service is unavailable',
        503
      );
    }
  }

  /**
   * Store backtest result in R2
   */
  protected async storeResult(result: BacktestResult): Promise<string> {
    const key = `backtests/${result.id}.json`;
    
    try {
      await this.env.R2.put(key, JSON.stringify(result), {
        httpMetadata: {
          contentType: 'application/json'
        },
        customMetadata: {
          symbol: result.config.symbol,
          strategy: result.config.strategy,
          createdAt: result.createdAt
        }
      });

      // Also cache in KV for quick access
      await this.env.CACHE.put(`backtest:result:${result.id}`, JSON.stringify(result), {
        expirationTtl: 3600 // 1 hour
      });

      console.log(`[${this.requestId}] Stored backtest result ${result.id}`);
      return key;
    } catch (error) {
      console.error(`[${this.requestId}] Failed to store result:`, error);
      throw new AppError(
        'STORAGE_ERROR',
        'Failed to store backtest result',
        500
      );
    }
  }

  /**
   * Get backtest result
   */
  async getResult(backtestId: string): Promise<BacktestResult | null> {
    // Check cache first
    const cached = await this.env.CACHE.get(`backtest:result:${backtestId}`, 'json') as BacktestResult | null;
    if (cached) return cached;

    // Get from R2
    const key = `backtests/${backtestId}.json`;
    const object = await this.env.R2.get(key);
    
    if (!object) return null;

    const result = await object.json() as BacktestResult;
    
    // Re-cache
    await this.env.CACHE.put(`backtest:result:${backtestId}`, JSON.stringify(result), {
      expirationTtl: 3600
    });

    return result;
  }

  /**
   * Update backtest progress
   */
  protected async updateProgress(progress: BacktestProgress): Promise<void> {
    const key = `backtest:progress:${progress.backtestId}`;
    
    await this.env.CACHE.put(key, JSON.stringify(progress), {
      expirationTtl: 300 // 5 minutes
    });

    // Also send via WebSocket if connected
    const durableObjectId = this.env.TRADING_SESSION.idFromName(progress.backtestId);
    const durableObject = this.env.TRADING_SESSION.get(durableObjectId);
    
    await durableObject.fetch(new Request('http://internal/progress', {
      method: 'POST',
      body: JSON.stringify(progress)
    }));
  }

  /**
   * Generate unique backtest ID
   */
  protected generateBacktestId(): string {
    return `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old backtests
   */
  async cleanupOldBacktests(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deleted = 0;
    const listed = await this.env.R2.list({ prefix: 'backtests/' });
    
    for (const object of listed.objects) {
      if (object.uploaded < cutoffDate) {
        await this.env.R2.delete(object.key);
        deleted++;
      }
    }

    console.log(`[${this.requestId}] Cleaned up ${deleted} old backtests`);
    return deleted;
  }

  /**
   * List recent backtests
   */
  async listRecentBacktests(limit: number = 10): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];
    const listed = await this.env.R2.list({ 
      prefix: 'backtests/',
      limit 
    });

    for (const object of listed.objects) {
      const result = await this.env.R2.get(object.key);
      if (result) {
        const backtest = await result.json() as BacktestResult;
        results.push(backtest);
      }
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return results.slice(0, limit);
  }
}