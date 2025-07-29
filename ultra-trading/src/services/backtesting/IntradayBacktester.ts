/**
 * ULTRA Trading Platform - Intraday Backtester
 * Strategy validation with 1-minute data
 */

import type { CloudflareBindings } from '../../types';
import type { 
  BacktestConfig, 
  BacktestResult,
  BacktestMetrics,
  BacktestRequest
} from '../../types/backtesting';
import { FastquantBacktesterBase } from './FastquantBacktesterBase';
import { AppError } from '../../utils';

interface IntradayStrategy {
  name: 'OPENING_RANGE' | 'VWAP_REVERSION' | 'RSI_EXTREMES';
  parameters: IntradayParameters;
}

interface IntradayParameters {
  // Opening Range Breakout
  openingRangeMinutes?: number;
  breakoutThreshold?: number;
  stopLossPercent?: number;
  
  // VWAP Mean Reversion
  vwapStdDev?: number;
  reversionTarget?: number;
  holdingPeriodMinutes?: number;
  
  // RSI Extremes (1-min)
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  exitRsi?: number;
}

interface DailyTargetValidation {
  symbol: string;
  strategy: string;
  canAchieveTarget: boolean;
  expectedDailyReturn: number;
  requiredTrades: number;
  winRateNeeded: number;
  feasibilityScore: number; // 0-1
}

/**
 * Intraday backtester for high-frequency strategies
 * Validates $300 daily target feasibility
 */
export class IntradayBacktester extends FastquantBacktesterBase {
  private readonly DAILY_TARGET = 300; // $300 daily profit target
  private readonly ACCOUNT_SIZE = 25000; // PDT minimum
  
  constructor(env: CloudflareBindings, requestId: string) {
    super(env, requestId);
  }

  /**
   * Execute intraday backtest with 1-minute data
   */
  async execute(config: BacktestConfig): Promise<BacktestResult> {
    // Get 1-minute data
    const ohlcvData = await this.getHistoricalData(
      config.symbol,
      config.startDate,
      config.endDate,
      '1m'
    );

    // Prepare request
    const request: BacktestRequest = {
      type: 'single',
      config: {
        ...config,
        parameters: {
          ...config.parameters
        }
      },
      requestId: this.generateBacktestId()
    };
    
    (request as any).data = ohlcvData;

    // Execute backtest
    const response = await this.executePythonBacktest(request);
    
    if (!response.success || !response.result) {
      throw new AppError(
        'BACKTEST_FAILED',
        response.error || 'Intraday backtest failed',
        500
      );
    }

    return response.result as BacktestResult;
  }

  /**
   * Test opening range breakout strategy
   */
  async testOpeningRangeBreakout(
    symbol: string,
    days = 20,
    parameters?: IntradayParameters
  ): Promise<BacktestResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const config: BacktestConfig = {
      symbol,
      startDate: startDate.toISOString().split('T')[0] || '',
      endDate: endDate.toISOString().split('T')[0] || '',
      strategy: 'OPENING_RANGE',
      parameters: {
        openingRangeMinutes: parameters?.openingRangeMinutes || 30,
        breakoutThreshold: parameters?.breakoutThreshold || 0.005, // 0.5%
        stopLossPercent: parameters?.stopLossPercent || 0.002, // 0.2%
        ...parameters
      },
      initialCapital: this.ACCOUNT_SIZE,
      commission: 0.0005, // $0.005 per share
      slippage: 0.0001 // 1 cent per $100
    };

    console.log(`[${this.requestId}] Testing opening range breakout for ${symbol}`);
    
    // Get 1-minute data
    const ohlcvData = await this.getHistoricalData(
      symbol,
      config.startDate,
      config.endDate,
      '1m'
    );

    // Prepare request
    const request: BacktestRequest = {
      type: 'single',
      config,
      requestId: this.generateBacktestId()
    };
    
    (request as any).data = ohlcvData;

    // Execute backtest
    const response = await this.executePythonBacktest(request);
    
    if (!response.success || !response.result) {
      throw new AppError(
        'BACKTEST_FAILED',
        response.error || 'Opening range backtest failed',
        500
      );
    }

    return response.result as BacktestResult;
  }

  /**
   * Test VWAP mean reversion strategy
   */
  async testVWAPReversion(
    symbol: string,
    days = 20,
    parameters?: IntradayParameters
  ): Promise<BacktestResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const config: BacktestConfig = {
      symbol,
      startDate: startDate.toISOString().split('T')[0] || '',
      endDate: endDate.toISOString().split('T')[0] || '',
      strategy: 'VWAP_REVERSION',
      parameters: {
        vwapStdDev: parameters?.vwapStdDev || 2.0,
        reversionTarget: parameters?.reversionTarget || 0.5, // Revert 50% to VWAP
        holdingPeriodMinutes: parameters?.holdingPeriodMinutes || 15,
        ...parameters
      },
      initialCapital: this.ACCOUNT_SIZE,
      commission: 0.0005,
      slippage: 0.0001
    };

    console.log(`[${this.requestId}] Testing VWAP reversion for ${symbol}`);
    
    const ohlcvData = await this.getHistoricalData(
      symbol,
      config.startDate,
      config.endDate,
      '1m'
    );

    const request: BacktestRequest = {
      type: 'single',
      config,
      requestId: this.generateBacktestId()
    };
    
    (request as any).data = ohlcvData;

    const response = await this.executePythonBacktest(request);
    
    if (!response.success || !response.result) {
      throw new AppError(
        'BACKTEST_FAILED',
        response.error || 'VWAP reversion backtest failed',
        500
      );
    }

    return response.result as BacktestResult;
  }

  /**
   * Test RSI extremes strategy on 1-minute data
   */
  async testRSIExtremes(
    symbol: string,
    days = 20,
    parameters?: IntradayParameters
  ): Promise<BacktestResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const config: BacktestConfig = {
      symbol,
      startDate: startDate.toISOString().split('T')[0] || '',
      endDate: endDate.toISOString().split('T')[0] || '',
      strategy: 'RSI_EXTREMES',
      parameters: {
        rsiPeriod: parameters?.rsiPeriod || 5, // Short period for 1-min
        rsiOverbought: parameters?.rsiOverbought || 80,
        rsiOversold: parameters?.rsiOversold || 20,
        exitRsi: parameters?.exitRsi || 50,
        ...parameters
      },
      initialCapital: this.ACCOUNT_SIZE,
      commission: 0.0005,
      slippage: 0.0001
    };

    console.log(`[${this.requestId}] Testing RSI extremes for ${symbol}`);
    
    const ohlcvData = await this.getHistoricalData(
      symbol,
      config.startDate,
      config.endDate,
      '1m'
    );

    const request: BacktestRequest = {
      type: 'single',
      config,
      requestId: this.generateBacktestId()
    };
    
    (request as any).data = ohlcvData;

    const response = await this.executePythonBacktest(request);
    
    if (!response.success || !response.result) {
      throw new AppError(
        'BACKTEST_FAILED',
        response.error || 'RSI extremes backtest failed',
        500
      );
    }

    return response.result as BacktestResult;
  }

  /**
   * Validate if $300 daily target is feasible
   */
  async validateDailyTarget(
    symbols: string[] = ['SPY', 'QQQ']
  ): Promise<DailyTargetValidation[]> {
    const validations: DailyTargetValidation[] = [];
    const strategies: IntradayStrategy[] = [
      { name: 'OPENING_RANGE', parameters: {} },
      { name: 'VWAP_REVERSION', parameters: {} },
      { name: 'RSI_EXTREMES', parameters: {} }
    ];

    for (const symbol of symbols) {
      for (const strategy of strategies) {
        try {
          // Run backtest for strategy
          let result: BacktestResult;
          
          switch (strategy.name) {
            case 'OPENING_RANGE':
              result = await this.testOpeningRangeBreakout(symbol, 20, strategy.parameters);
              break;
            case 'VWAP_REVERSION':
              result = await this.testVWAPReversion(symbol, 20, strategy.parameters);
              break;
            case 'RSI_EXTREMES':
              result = await this.testRSIExtremes(symbol, 20, strategy.parameters);
              break;
          }

          // Analyze if daily target is achievable
          const validation = this.analyzeDailyTargetFeasibility(
            symbol,
            strategy.name,
            result.metrics
          );
          
          validations.push(validation);
        } catch (error) {
          console.error(
            `[${this.requestId}] Failed to validate ${strategy.name} for ${symbol}:`,
            error
          );
          
          validations.push({
            symbol,
            strategy: strategy.name,
            canAchieveTarget: false,
            expectedDailyReturn: 0,
            requiredTrades: 0,
            winRateNeeded: 0,
            feasibilityScore: 0
          });
        }
      }
    }

    // Sort by feasibility score
    validations.sort((a, b) => b.feasibilityScore - a.feasibilityScore);

    return validations;
  }

  /**
   * Analyze if daily target is feasible based on backtest metrics
   */
  private analyzeDailyTargetFeasibility(
    symbol: string,
    strategy: string,
    metrics: BacktestMetrics
  ): DailyTargetValidation {
    // Calculate daily metrics
    const tradingDays = 252;
    const dailyReturn = metrics.annualizedReturn / tradingDays;
    const expectedDailyProfit = this.ACCOUNT_SIZE * dailyReturn;
    
    // Calculate trades needed for target
    const avgProfitPerTrade = (metrics.avgWin * metrics.winRate) - 
                             (Math.abs(metrics.avgLoss) * (1 - metrics.winRate));
    const avgTradeSize = this.ACCOUNT_SIZE * 0.2; // 20% position size
    const avgDollarProfitPerTrade = avgTradeSize * avgProfitPerTrade;
    
    const requiredTrades = Math.ceil(this.DAILY_TARGET / avgDollarProfitPerTrade);
    
    // Calculate required win rate
    // const breakEvenWinRate = Math.abs(metrics.avgLoss) / 
    //                         (Math.abs(metrics.avgLoss) + metrics.avgWin);
    const targetWinRate = this.calculateRequiredWinRate(
      this.DAILY_TARGET,
      requiredTrades,
      avgTradeSize,
      metrics.avgWin,
      Math.abs(metrics.avgLoss)
    );
    
    // Calculate feasibility score
    const feasibilityScore = this.calculateFeasibilityScore(
      expectedDailyProfit,
      requiredTrades,
      metrics.winRate,
      targetWinRate,
      metrics.sharpeRatio
    );
    
    return {
      symbol,
      strategy,
      canAchieveTarget: expectedDailyProfit >= this.DAILY_TARGET,
      expectedDailyReturn: expectedDailyProfit,
      requiredTrades,
      winRateNeeded: targetWinRate,
      feasibilityScore
    };
  }

  /**
   * Calculate required win rate to achieve daily target
   */
  private calculateRequiredWinRate(
    dailyTarget: number,
    numTrades: number,
    avgTradeSize: number,
    avgWinPercent: number,
    avgLossPercent: number
  ): number {
    // Solve for win rate: target = numTrades * tradeSize * (winRate * avgWin - (1-winRate) * avgLoss)
    const profitPerWin = avgTradeSize * avgWinPercent;
    const lossPerLoss = avgTradeSize * avgLossPercent;
    
    const requiredWinRate = (dailyTarget + numTrades * lossPerLoss) / 
                           (numTrades * (profitPerWin + lossPerLoss));
    
    return Math.max(0, Math.min(1, requiredWinRate));
  }

  /**
   * Calculate feasibility score (0-1)
   */
  private calculateFeasibilityScore(
    expectedDailyProfit: number,
    requiredTrades: number,
    actualWinRate: number,
    targetWinRate: number,
    sharpeRatio: number
  ): number {
    let score = 0;
    
    // Profit achievement (40% weight)
    const profitRatio = Math.min(1, expectedDailyProfit / this.DAILY_TARGET);
    score += profitRatio * 0.4;
    
    // Win rate feasibility (30% weight)
    if (targetWinRate <= actualWinRate) {
      score += 0.3;
    } else {
      const winRateGap = targetWinRate - actualWinRate;
      score += Math.max(0, 0.3 * (1 - winRateGap));
    }
    
    // Trade count feasibility (20% weight)
    // Assume max 50 trades per day is reasonable
    const tradeCountScore = Math.max(0, 1 - (requiredTrades / 50));
    score += tradeCountScore * 0.2;
    
    // Risk-adjusted returns (10% weight)
    const sharpeScore = Math.min(1, sharpeRatio / 2); // Sharpe of 2+ is excellent
    score += sharpeScore * 0.1;
    
    return score;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    symbols: string[] = ['SPY', 'QQQ', 'IWM', 'DIA']
  ): Promise<{
    summary: string;
    recommendations: string[];
    bestStrategies: {
      symbol: string;
      strategy: string;
      metrics: BacktestMetrics;
    }[];
  }> {
    const validations = await this.validateDailyTarget(symbols);
    
    // Find best strategies
    const bestStrategies = validations
      .filter(v => v.feasibilityScore > 0.7)
      .slice(0, 3)
      .map(v => ({
        symbol: v.symbol,
        strategy: v.strategy,
        metrics: {} as BacktestMetrics // Would be populated from actual backtest
      }));
    
    // Generate summary
    const achievableCount = validations.filter(v => v.canAchieveTarget).length;
    const avgFeasibility = validations.reduce((sum, v) => sum + v.feasibilityScore, 0) / 
                          validations.length;
    
    const summary = `Tested ${validations.length} strategy combinations. ` +
                   `${achievableCount} can achieve $${this.DAILY_TARGET} daily target. ` +
                   `Average feasibility score: ${(avgFeasibility * 100).toFixed(1)}%`;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (achievableCount === 0) {
      recommendations.push('Consider lowering daily target or increasing account size');
      recommendations.push('Focus on higher probability setups');
    } else {
      const best = validations[0];
      if (best) {
        recommendations.push(
          `Focus on ${best.strategy} strategy for ${best.symbol} ` +
          `(${(best.feasibilityScore * 100).toFixed(0)}% feasibility)`
        );
        
        if (best.requiredTrades > 20) {
          recommendations.push('High trade frequency required - ensure low latency execution');
        }
        
        if (best.winRateNeeded > 0.6) {
          recommendations.push('High win rate needed - be selective with entries');
        }
      }
    }
    
    // Add general recommendations
    recommendations.push('Include transaction costs in all calculations');
    recommendations.push('Start with smaller position sizes to validate strategy');
    recommendations.push('Monitor performance daily and adjust parameters');
    
    return {
      summary,
      recommendations,
      bestStrategies
    };
  }

  /**
   * Schedule nightly backtest run
   */
  async scheduleNightlyRun(time = '21:00'): Promise<void> {
    const scheduledTime = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    scheduledTime.setHours(hours || 21, minutes || 0, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (scheduledTime < new Date()) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    // const delay = scheduledTime.getTime() - Date.now();
    
    console.log(
      `[${this.requestId}] Scheduling nightly backtest for ${scheduledTime.toISOString()}`
    );
    
    // Store schedule in KV
    await this.env.CACHE.put(
      'backtest:schedule:nightly',
      JSON.stringify({
        nextRun: scheduledTime.toISOString(),
        symbols: ['SPY', 'QQQ', 'IWM'],
        strategies: ['OPENING_RANGE', 'VWAP_REVERSION', 'RSI_EXTREMES']
      }),
      {
        expirationTtl: 86400 // 24 hours
      }
    );
  }
}