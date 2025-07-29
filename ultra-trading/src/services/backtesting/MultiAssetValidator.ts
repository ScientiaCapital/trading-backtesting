/**
 * ULTRA Trading Platform - Multi-Asset Validator
 * Portfolio optimization across stocks, crypto, and options
 */

import type { CloudflareBindings } from '../../types';
import type { 
  BacktestConfig,
  BacktestResult,
  MultiAssetBacktestConfig,
  MultiAssetBacktestResult,
  BacktestRequest,
  BacktestMetrics
} from '../../types/backtesting';
import { FastquantBacktesterBase } from './FastquantBacktesterBase';
import { AppError } from '../../utils';

interface AssetCorrelation {
  asset1: string;
  asset2: string;
  correlation: number;
  period: string;
}

interface MarketRegime {
  type: 'trending' | 'choppy' | 'volatile' | 'calm';
  confidence: number;
  indicators: {
    vix: number;
    trendStrength: number;
    volatility: number;
  };
}


interface PortfolioAnalysis {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  correlations: AssetCorrelation[];
  regime: MarketRegime;
  rebalanceCount: number;
}

/**
 * Multi-asset portfolio validator and optimizer
 */
export class MultiAssetValidator extends FastquantBacktesterBase {
  private readonly DEFAULT_ACCOUNT_SIZE = 200000;
  
  constructor(env: CloudflareBindings, requestId: string) {
    super(env, requestId);
  }

  /**
   * Execute a backtest (required by abstract base class)
   */
  async execute(config: BacktestConfig): Promise<BacktestResult> {
    // Convert BacktestConfig to MultiAssetBacktestConfig
    const multiAssetConfig: MultiAssetBacktestConfig = {
      assets: [{ 
        symbol: config.symbol, 
        allocation: 1.0, 
        assetClass: 'stock' 
      }],
      rebalanceFrequency: 'monthly',
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital || this.DEFAULT_ACCOUNT_SIZE
    };
    
    const result = await this.validatePortfolio(multiAssetConfig);
    
    // Convert MultiAssetBacktestResult to BacktestResult
    return {
      id: `backtest-${Date.now()}`,
      config,
      metrics: {
        totalReturn: result.portfolioMetrics.totalReturn,
        annualizedReturn: result.portfolioMetrics.annualizedReturn,
        sharpeRatio: result.portfolioMetrics.sharpeRatio,
        maxDrawdown: result.portfolioMetrics.maxDrawdown,
        winRate: result.portfolioMetrics.winRate || 0,
        profitFactor: result.portfolioMetrics.profitFactor || 0,
        totalTrades: result.portfolioMetrics.totalTrades || 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgHoldingPeriod: 0,
        finalValue: result.portfolioMetrics.totalReturn * (config.initialCapital || this.DEFAULT_ACCOUNT_SIZE)
      },
      trades: [],
      equityCurve: [],
      dates: [],
      status: 'completed' as const,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Validate multi-asset portfolio
   */
  async validatePortfolio(
    config: MultiAssetBacktestConfig
  ): Promise<MultiAssetBacktestResult> {
    const backtestId = this.generateBacktestId();
    
    try {
      console.log(`[${this.requestId}] Starting multi-asset validation ${backtestId}`);
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 10,
        currentStep: 'Fetching historical data for all assets'
      });

      // Fetch data for all assets
      const assetData = await this.fetchAllAssetData(config);
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 30,
        currentStep: 'Calculating asset correlations'
      });

      // Calculate correlations
      // const correlations = await this.calculateCorrelations(assetData);
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 40,
        currentStep: 'Analyzing market regime'
      });

      // Determine market regime
      const regime = await this.analyzeMarketRegime(assetData);
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 50,
        currentStep: 'Running portfolio backtest'
      });

      // Run multi-asset backtest
      const request: BacktestRequest = {
        type: 'multi-asset',
        config,
        requestId: backtestId
      };
      
      // Add asset data to request
      (request as any).assetData = assetData;
      
      const response = await this.executePythonBacktest(request);
      
      if (!response.success || !response.result) {
        throw new AppError(
          'MULTI_ASSET_BACKTEST_FAILED',
          response.error || 'Multi-asset backtest failed',
          500
        );
      }

      const result = response.result as MultiAssetBacktestResult;
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 80,
        currentStep: 'Optimizing portfolio allocation'
      });

      // Optimize allocation based on regime
      const optimalAllocation = await this.optimizeAllocation(
        config,
        result,
        regime
      );
      
      // Update result with our optimizations
      result.optimalAllocation = optimalAllocation;
      
      // Update progress
      await this.updateProgress({
        backtestId,
        progress: 100,
        currentStep: 'Completed'
      });

      // Store result
      await this.storeMultiAssetResult(backtestId, result);
      
      return result;
    } catch (error) {
      console.error(`[${this.requestId}] Multi-asset validation failed:`, error);
      throw error;
    }
  }

  /**
   * Test strategies across asset classes
   */
  async testCrossAssetStrategies(
    symbols: {
      stocks: string[];
      crypto: string[];
      options: string[];
    }
  ): Promise<{
    assetClass: string;
    performance: BacktestMetrics;
    recommendation: string;
  }[]> {
    const results = [];
    
    // Test stock strategies
    for (const symbol of symbols.stocks) {
      const config: MultiAssetBacktestConfig = {
        assets: [{
          symbol,
          allocation: 1.0,
          assetClass: 'stock'
        }],
        rebalanceFrequency: 'monthly',
        startDate: this.getStartDate(60),
        endDate: new Date().toISOString().split('T')[0] || '',
        initialCapital: this.DEFAULT_ACCOUNT_SIZE
      };
      
      const result = await this.validatePortfolio(config);
      
      results.push({
        assetClass: 'stock',
        performance: result.portfolioMetrics,
        recommendation: this.generateRecommendation('stock', result.portfolioMetrics)
      });
    }
    
    // Test crypto strategies (24/7 trading)
    for (const symbol of symbols.crypto) {
      const config: MultiAssetBacktestConfig = {
        assets: [{
          symbol,
          allocation: 1.0,
          assetClass: 'crypto'
        }],
        rebalanceFrequency: 'weekly', // More frequent for crypto
        startDate: this.getStartDate(30), // Shorter period for crypto
        endDate: new Date().toISOString().split('T')[0] || '',
        initialCapital: this.DEFAULT_ACCOUNT_SIZE * 0.2 // Smaller allocation
      };
      
      const result = await this.validatePortfolio(config);
      
      results.push({
        assetClass: 'crypto',
        performance: result.portfolioMetrics,
        recommendation: this.generateRecommendation('crypto', result.portfolioMetrics)
      });
    }
    
    // Test options strategies (using proxies)
    for (const symbol of symbols.options) {
      // Use underlying stock as proxy with higher volatility assumption
      const config: MultiAssetBacktestConfig = {
        assets: [{
          symbol: symbol.replace('_OPTION', ''), // Remove option suffix
          allocation: 1.0,
          assetClass: 'option'
        }],
        rebalanceFrequency: 'daily', // Options need daily management
        startDate: this.getStartDate(20),
        endDate: new Date().toISOString().split('T')[0] || '',
        initialCapital: this.DEFAULT_ACCOUNT_SIZE * 0.3
      };
      
      const result = await this.validatePortfolio(config);
      
      // Adjust metrics for options characteristics
      if (result.portfolioMetrics.volatility !== undefined) {
        result.portfolioMetrics.volatility *= 2; // Options are more volatile
      }
      if (result.portfolioMetrics.totalReturn !== undefined) {
        result.portfolioMetrics.totalReturn *= 1.5; // Leverage effect
      }
      
      results.push({
        assetClass: 'option',
        performance: result.portfolioMetrics,
        recommendation: this.generateRecommendation('option', result.portfolioMetrics)
      });
    }
    
    return results;
  }

  /**
   * Optimize portfolio for different market regimes
   */
  async optimizeForMarketRegime(
    assets: string[],
    currentRegime?: MarketRegime
  ): Promise<{
    regime: MarketRegime;
    allocation: Record<string, number>;
    expectedPerformance: PortfolioAnalysis;
  }> {
    // Determine current regime if not provided
    const regime = currentRegime || await this.getCurrentMarketRegime();
    
    // Define regime-specific allocations
    const regimeAllocations = this.getRegimeAllocations(assets, regime);
    
    // Backtest the allocation
    const config: MultiAssetBacktestConfig = {
      assets: Object.entries(regimeAllocations).map(([symbol, allocation]) => ({
        symbol,
        allocation,
        assetClass: this.getAssetClass(symbol)
      })),
      rebalanceFrequency: 'monthly',
      startDate: this.getStartDate(90),
      endDate: new Date().toISOString().split('T')[0] || '',
      initialCapital: this.DEFAULT_ACCOUNT_SIZE
    };
    
    const result = await this.validatePortfolio(config);
    
    // Create portfolio analysis
    const analysis: PortfolioAnalysis = {
      totalReturn: result.portfolioMetrics.totalReturn,
      annualizedReturn: result.portfolioMetrics.annualizedReturn,
      volatility: result.portfolioMetrics.maxDrawdown * 2, // Approximate
      sharpeRatio: result.portfolioMetrics.sharpeRatio,
      maxDrawdown: result.portfolioMetrics.maxDrawdown,
      correlations: this.extractCorrelations(result.correlationMatrix, assets),
      regime,
      rebalanceCount: result.rebalanceDates.length
    };
    
    return {
      regime,
      allocation: regimeAllocations,
      expectedPerformance: analysis
    };
  }

  /**
   * Calculate optimal position sizes based on volatility
   */
  async calculateVolatilityBasedSizing(
    assets: { symbol: string; volatility?: number }[]
  ): Promise<Record<string, number>> {
    const sizing: Record<string, number> = {};
    
    // Get volatility for each asset
    const volatilities: Record<string, number> = {};
    
    for (const asset of assets) {
      if (asset.volatility) {
        volatilities[asset.symbol] = asset.volatility;
      } else {
        // Calculate historical volatility
        const data = await this.getHistoricalData(
          asset.symbol,
          this.getStartDate(30),
          new Date().toISOString().split('T')[0] || ''
        );
        
        volatilities[asset.symbol] = this.calculateVolatility(data);
      }
    }
    
    // Calculate inverse volatility weights
    const totalInverseVol = Object.values(volatilities)
      .reduce((sum, vol) => sum + (1 / vol), 0);
    
    for (const [symbol, vol] of Object.entries(volatilities)) {
      sizing[symbol] = (1 / vol) / totalInverseVol;
    }
    
    return sizing;
  }

  /**
   * Validate against risk management constraints
   */
  async validateRiskConstraints(
    allocation: Record<string, number>,
    constraints: {
      maxPositionSize: number;
      maxSectorExposure?: number;
      maxAssetClassExposure?: number;
      maxCorrelation?: number;
    }
  ): Promise<{
    valid: boolean;
    violations: string[];
    adjustedAllocation?: Record<string, number>;
  }> {
    const violations: string[] = [];
    let valid = true;
    
    // Check position size constraints
    for (const [symbol, weight] of Object.entries(allocation)) {
      if (weight > constraints.maxPositionSize) {
        violations.push(
          `${symbol} allocation ${(weight * 100).toFixed(1)}% exceeds max ${
            constraints.maxPositionSize * 100
          }%`
        );
        valid = false;
      }
    }
    
    // Check asset class exposure
    if (constraints.maxAssetClassExposure) {
      const assetClassExposure: Record<string, number> = {};
      
      for (const [symbol, weight] of Object.entries(allocation)) {
        const assetClass = this.getAssetClass(symbol);
        assetClassExposure[assetClass] = (assetClassExposure[assetClass] || 0) + weight;
      }
      
      for (const [assetClass, exposure] of Object.entries(assetClassExposure)) {
        if (exposure > constraints.maxAssetClassExposure) {
          violations.push(
            `${assetClass} exposure ${(exposure * 100).toFixed(1)}% exceeds max ${
              constraints.maxAssetClassExposure * 100
            }%`
          );
          valid = false;
        }
      }
    }
    
    // If invalid, create adjusted allocation
    let adjustedAllocation: Record<string, number> | undefined;
    
    if (!valid) {
      adjustedAllocation = this.adjustAllocationForConstraints(
        allocation,
        constraints
      );
    }
    
    return {
      valid,
      violations,
      adjustedAllocation
    };
  }

  /**
   * Fetch historical data for all assets
   */
  private async fetchAllAssetData(
    config: MultiAssetBacktestConfig
  ): Promise<Record<string, any>> {
    const assetData: Record<string, any> = {};
    
    for (const asset of config.assets) {
      try {
        const data = await this.getHistoricalData(
          asset.symbol,
          config.startDate,
          config.endDate
        );
        
        assetData[asset.symbol] = data;
      } catch (error) {
        console.error(
          `[${this.requestId}] Failed to fetch data for ${asset.symbol}:`,
          error
        );
        // Use empty data as fallback
        assetData[asset.symbol] = {
          date: [],
          open: [],
          high: [],
          low: [],
          close: [],
          volume: []
        };
      }
    }
    
    return assetData;
  }


  /**
   * Analyze current market regime
   */
  private async analyzeMarketRegime(
    assetData: Record<string, any>
  ): Promise<MarketRegime> {
    // Simplified regime detection
    // In production, use VIX, trend indicators, etc.
    
    const volatilities = Object.values(assetData).map(data => 
      this.calculateVolatility(data)
    );
    
    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    
    let type: MarketRegime['type'];
    const confidence = 0.7;
    
    if (avgVolatility < 0.15) {
      type = 'calm';
    } else if (avgVolatility < 0.25) {
      type = 'trending';
    } else if (avgVolatility < 0.35) {
      type = 'choppy';
    } else {
      type = 'volatile';
    }
    
    return {
      type,
      confidence,
      indicators: {
        vix: avgVolatility * 100, // Approximation
        trendStrength: 0.5,
        volatility: avgVolatility
      }
    };
  }

  /**
   * Optimize allocation based on regime
   */
  private async optimizeAllocation(
    config: MultiAssetBacktestConfig,
    _result: MultiAssetBacktestResult,
    regime: MarketRegime
  ): Promise<Record<string, number>> {
    const optimal: Record<string, number> = {};
    
    // Start with equal weight
    const equalWeight = 1 / config.assets.length;
    
    for (const asset of config.assets) {
      let weight = equalWeight;
      
      // Adjust based on regime
      switch (regime.type) {
        case 'volatile':
          // Reduce risky assets
          if (asset.assetClass === 'crypto' || asset.assetClass === 'option') {
            weight *= 0.5;
          }
          break;
          
        case 'trending':
          // Increase momentum assets
          if (asset.assetClass === 'stock') {
            weight *= 1.2;
          }
          break;
          
        case 'choppy':
          // Favor mean reversion
          if (asset.assetClass === 'crypto') {
            weight *= 0.8;
          }
          break;
      }
      
      optimal[asset.symbol] = weight;
    }
    
    // Normalize weights
    const totalWeight = Object.values(optimal).reduce((a, b) => a + b, 0);
    
    if (totalWeight > 0) {
      for (const symbol in optimal) {
        const weight = optimal[symbol];
        if (weight !== undefined) {
          optimal[symbol] = weight / totalWeight;
        }
      }
    }
    
    return optimal;
  }

  /**
   * Calculate volatility from OHLCV data
   */
  private calculateVolatility(data: any): number {
    if (!data.close || data.close.length < 2) return 0.2; // Default
    
    const returns: number[] = [];
    
    for (let i = 1; i < data.close.length; i++) {
      const ret = (data.close[i] - data.close[i - 1]) / data.close[i - 1];
      returns.push(ret);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized
  }


  /**
   * Get asset class from symbol
   */
  private getAssetClass(symbol: string): 'stock' | 'crypto' | 'option' {
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('/USD')) {
      return 'crypto';
    } else if (symbol.includes('_OPTION')) {
      return 'option';
    }
    return 'stock';
  }

  /**
   * Get regime-specific allocations
   */
  private getRegimeAllocations(
    assets: string[],
    regime: MarketRegime
  ): Record<string, number> {
    const allocations: Record<string, number> = {};
    
    const weights = {
      volatile: { stock: 0.6, crypto: 0.1, option: 0.3 },
      trending: { stock: 0.7, crypto: 0.2, option: 0.1 },
      choppy: { stock: 0.5, crypto: 0.3, option: 0.2 },
      calm: { stock: 0.6, crypto: 0.2, option: 0.2 }
    };
    
    const regimeWeights = weights[regime.type];
    
    // Distribute weights among assets
    const assetsByClass = {
      stock: assets.filter(a => this.getAssetClass(a) === 'stock'),
      crypto: assets.filter(a => this.getAssetClass(a) === 'crypto'),
      option: assets.filter(a => this.getAssetClass(a) === 'option')
    };
    
    for (const [assetClass, symbols] of Object.entries(assetsByClass)) {
      const classWeight = regimeWeights[assetClass as keyof typeof regimeWeights];
      const perAssetWeight = symbols.length > 0 ? classWeight / symbols.length : 0;
      
      for (const symbol of symbols) {
        allocations[symbol] = perAssetWeight;
      }
    }
    
    return allocations;
  }

  /**
   * Extract correlations from matrix
   */
  private extractCorrelations(
    matrix: number[][],
    assets: string[]
  ): AssetCorrelation[] {
    const correlations: AssetCorrelation[] = [];
    
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const correlation = matrix[i]?.[j];
        const asset1 = assets[i];
        const asset2 = assets[j];
        if (correlation !== undefined && asset1 && asset2) {
          correlations.push({
            asset1,
            asset2,
            correlation,
            period: '60d'
          });
        }
      }
    }
    
    return correlations;
  }

  /**
   * Generate recommendation based on metrics
   */
  private generateRecommendation(
    assetClass: string,
    metrics: BacktestMetrics
  ): string {
    const sharpe = metrics.sharpeRatio;
    const maxDD = metrics.maxDrawdown;
    
    if (sharpe > 1.5 && maxDD < 0.15) {
      return `Strong performance for ${assetClass}. Consider increasing allocation.`;
    } else if (sharpe > 1 && maxDD < 0.2) {
      return `Good risk-adjusted returns for ${assetClass}. Maintain current strategy.`;
    } else if (sharpe < 0.5 || maxDD > 0.3) {
      return `Poor performance for ${assetClass}. Review strategy or reduce allocation.`;
    } else {
      return `Moderate performance for ${assetClass}. Monitor closely.`;
    }
  }

  /**
   * Adjust allocation for constraints
   */
  private adjustAllocationForConstraints(
    allocation: Record<string, number>,
    constraints: any
  ): Record<string, number> {
    const adjusted = { ...allocation };
    
    // Cap individual positions
    for (const symbol in adjusted) {
      const currentSize = adjusted[symbol];
      const maxSize = constraints?.maxPositionSize;
      
      if (currentSize !== undefined && maxSize !== undefined && currentSize > maxSize) {
        adjusted[symbol] = maxSize;
      }
    }
    
    // Renormalize
    const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
    
    if (total > 0) {
      for (const symbol in adjusted) {
        const value = adjusted[symbol];
        if (value !== undefined) {
          adjusted[symbol] = value / total;
        }
      }
    }
    
    return adjusted;
  }

  /**
   * Store multi-asset result
   */
  private async storeMultiAssetResult(
    id: string,
    result: MultiAssetBacktestResult
  ): Promise<void> {
    const key = `multi-asset/${id}.json`;
    
    await this.env.R2.put(key, JSON.stringify(result), {
      httpMetadata: {
        contentType: 'application/json'
      }
    });
    
    // Cache for quick access
    await this.env.CACHE.put(`multi-asset:${id}`, JSON.stringify(result), {
      expirationTtl: 3600
    });
  }

  /**
   * Get current market regime
   */
  private async getCurrentMarketRegime(): Promise<MarketRegime> {
    // Simplified - would use real market indicators
    return {
      type: 'trending',
      confidence: 0.7,
      indicators: {
        vix: 18,
        trendStrength: 0.6,
        volatility: 0.22
      }
    };
  }

  /**
   * Get start date N days back
   */
  private getStartDate(daysBack: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toISOString().split('T')[0] || '';
  }
}