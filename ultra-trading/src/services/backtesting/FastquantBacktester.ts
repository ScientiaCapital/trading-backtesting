/**
 * ULTRA Trading Platform - Fastquant Backtester
 * After-hours strategy optimization service
 */

import type { CloudflareBindings } from '../../types';
import type { 
  BacktestConfig, 
  BacktestResult,
  GridSearchConfig,
  GridSearchResult,
  BacktestMetrics,
  StrategyParameters,
  BacktestRequest
} from '../../types/backtesting';
import { FastquantBacktesterBase } from './FastquantBacktesterBase';
import { AppError } from '../../utils';

/**
 * Fastquant backtester for after-hours strategy optimization
 * Integrates with AfterHoursResearcher agent
 */
export class FastquantBacktester extends FastquantBacktesterBase {
  constructor(env: CloudflareBindings, requestId: string) {
    super(env, requestId);
  }

  /**
   * Execute a single backtest
   */
  async execute(config: BacktestConfig): Promise<BacktestResult> {
    const backtestId = this.generateBacktestId();
    const startTime = Date.now();

    try {
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 10,
        currentStep: 'Fetching historical data'
      });

      // Get historical data
      const ohlcvData = await this.getHistoricalData(
        config.symbol,
        config.startDate,
        config.endDate
      );

      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 30,
        currentStep: 'Preparing backtest request'
      });

      // Prepare request for Python service
      const request: BacktestRequest = {
        type: 'single',
        config: {
          ...config,
          initialCapital: config.initialCapital || 100000,
          commission: config.commission || 0.001, // 0.1%
          slippage: config.slippage || 0.001 // 0.1%
        },
        requestId: backtestId
      };

      // Add OHLCV data to request
      (request as any).data = ohlcvData;

      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 40,
        currentStep: 'Running backtest simulation'
      });

      // Execute Python backtest
      const response = await this.executePythonBacktest(request);

      if (!response.success || !response.result) {
        throw new AppError(
          'BACKTEST_FAILED',
          response.error || 'Backtest execution failed',
          500
        );
      }

      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 90,
        currentStep: 'Storing results'
      });

      // Create final result
      const result: BacktestResult = {
        ...(response.result as BacktestResult),
        id: backtestId,
        config,
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      // Store result
      await this.storeResult(result);

      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 100,
        currentStep: 'Completed'
      });

      const duration = Date.now() - startTime;
      console.log(`[${this.requestId}] Backtest ${backtestId} completed in ${duration}ms`);

      return result;
    } catch (error) {
      // Store failed result
      const failedResult: BacktestResult = {
        id: backtestId,
        config,
        metrics: this.getEmptyMetrics(),
        trades: [],
        equityCurve: [],
        dates: [],
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date().toISOString()
      };

      await this.storeResult(failedResult);
      throw error;
    }
  }

  /**
   * Execute grid search optimization
   */
  async executeGridSearch(config: GridSearchConfig): Promise<GridSearchResult> {
    const backtestId = this.generateBacktestId();
    console.log(`[${this.requestId}] Starting grid search ${backtestId}`);

    try {
      // Build parameter combinations
      const parameterCombinations = this.generateParameterCombinations(config.parameterRanges);
      const totalCombinations = parameterCombinations.length;

      console.log(`[${this.requestId}] Testing ${totalCombinations} parameter combinations`);

      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 10,
        currentStep: `Testing ${totalCombinations} parameter combinations`,
        estimatedTimeRemaining: totalCombinations * 30 // 30 seconds per combination estimate
      });

      // Prepare grid search request
      const request: BacktestRequest = {
        type: 'grid',
        config,
        requestId: backtestId
      };

      // Execute Python grid search
      const response = await this.executePythonBacktest(request);

      if (!response.success || !response.result) {
        throw new AppError(
          'GRID_SEARCH_FAILED',
          response.error || 'Grid search execution failed',
          500
        );
      }

      const gridResult = response.result as GridSearchResult;

      // Store result
      await this.storeGridSearchResult(backtestId, gridResult);

      return gridResult;
    } catch (error) {
      console.error(`[${this.requestId}] Grid search failed:`, error);
      throw error;
    }
  }

  /**
   * Optimize strategy for next day's trading
   */
  async optimizeForTomorrow(
    _symbol: string,
    strategy: 'RSI' | 'MACD' | 'BBANDS' | 'ODDTE_OPTIONS'
  ): Promise<{
    optimalParameters: StrategyParameters;
    expectedPerformance: BacktestMetrics;
    confidence: number;
  }> {
    // Get 60 days of historical data
    // const endDate = new Date(); // TODO: Use when implementing date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    const config: GridSearchConfig = {
      strategy,
      parameterRanges: this.getDefaultParameterRanges(strategy),
      metric: 'sharpe' // Optimize for risk-adjusted returns
    };

    // Run grid search
    const result = await this.executeGridSearch(config);

    // Analyze results for confidence
    const confidence = this.calculateConfidence(result);

    // Get expected performance
    const bestResult = result.allResults.find(
      r => r.parameters === result.bestParameters
    );

    return {
      optimalParameters: result.bestParameters,
      expectedPerformance: bestResult?.result || this.getEmptyMetrics(),
      confidence
    };
  }

  /**
   * Generate parameter combinations for grid search
   */
  private generateParameterCombinations(
    parameterRanges: Record<string, { min: number; max: number; step: number }>
  ): StrategyParameters[] {
    const combinations: StrategyParameters[] = [];
    const params = Object.entries(parameterRanges);

    // Recursive function to generate all combinations
    const generate = (index: number, current: StrategyParameters) => {
      if (index === params.length) {
        combinations.push({ ...current });
        return;
      }

      const param = params[index];
      if (!param) return;
      const [key, range] = param;
      for (let value = range.min; value <= range.max; value += range.step) {
        current[key] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Get default parameter ranges for strategies
   */
  private getDefaultParameterRanges(strategy: string): Record<string, any> {
    switch (strategy) {
      case 'RSI':
        return {
          rsi_period: { min: 10, max: 20, step: 2 },
          rsi_upper: { min: 65, max: 80, step: 5 },
          rsi_lower: { min: 20, max: 35, step: 5 }
        };
      
      case 'MACD':
        return {
          fast_period: { min: 10, max: 15, step: 1 },
          slow_period: { min: 20, max: 30, step: 2 },
          signal_period: { min: 7, max: 12, step: 1 }
        };
      
      case 'BBANDS':
        return {
          period: { min: 15, max: 25, step: 2 },
          devfactor: { min: 1.5, max: 2.5, step: 0.25 }
        };
      
      case 'ODDTE_OPTIONS':
        return {
          delta_threshold: { min: 0.2, max: 0.4, step: 0.05 },
          profit_target: { min: 0.2, max: 0.5, step: 0.1 },
          stop_loss: { min: 0.3, max: 0.6, step: 0.1 },
          volume_multiplier: { min: 3, max: 7, step: 1 }
        };
      
      default:
        return {};
    }
  }

  /**
   * Calculate confidence score for optimization results
   */
  private calculateConfidence(result: GridSearchResult): number {
    if (result.allResults.length === 0) return 0;

    // Sort results by metric
    const sorted = [...result.allResults].sort((a, b) => b.metric - a.metric);
    const firstResult = sorted[0];
    if (!firstResult) return 0;
    
    const bestMetric = firstResult.metric;

    // Calculate standard deviation
    const mean = sorted.reduce((sum, r) => sum + r.metric, 0) / sorted.length;
    const variance = sorted.reduce((sum, r) => sum + Math.pow(r.metric - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    // Calculate how many standard deviations the best is from mean
    const zScore = (bestMetric - mean) / (stdDev || 1);

    // Convert to confidence (0-1)
    // Higher z-score = higher confidence
    const confidence = Math.min(1, Math.max(0, zScore / 3));

    return confidence;
  }

  /**
   * Store grid search result
   */
  private async storeGridSearchResult(id: string, result: GridSearchResult): Promise<void> {
    const key = `grid-search/${id}.json`;
    
    await this.env.R2.put(key, JSON.stringify(result), {
      httpMetadata: {
        contentType: 'application/json'
      }
    });

    // Cache for quick access
    await this.env.CACHE.put(`grid-search:${id}`, JSON.stringify(result), {
      expirationTtl: 3600
    });
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): BacktestMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgHoldingPeriod: 0,
      finalValue: 0
    };
  }

  /**
   * Generate daily optimization report
   */
  async generateOptimizationReport(symbols: string[]): Promise<{
    symbol: string;
    strategy: string;
    parameters: StrategyParameters;
    expectedReturn: number;
    confidence: number;
  }[]> {
    const reports = [];

    for (const symbol of symbols) {
      // Test multiple strategies
      const strategies = ['RSI', 'MACD', 'BBANDS'] as const;
      let bestStrategy = null;
      let bestReturn = -Infinity;

      for (const strategy of strategies) {
        try {
          const result = await this.optimizeForTomorrow(symbol, strategy);
          
          if (result.expectedPerformance.annualizedReturn > bestReturn) {
            bestReturn = result.expectedPerformance.annualizedReturn;
            bestStrategy = {
              symbol,
              strategy,
              parameters: result.optimalParameters,
              expectedReturn: result.expectedPerformance.annualizedReturn,
              confidence: result.confidence
            };
          }
        } catch (error) {
          console.error(`[${this.requestId}] Failed to optimize ${strategy} for ${symbol}:`, error);
        }
      }

      if (bestStrategy) {
        reports.push(bestStrategy);
      }
    }

    // Sort by expected return
    reports.sort((a, b) => b.expectedReturn - a.expectedReturn);

    return reports;
  }
}