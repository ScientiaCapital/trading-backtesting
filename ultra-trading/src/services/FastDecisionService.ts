/**
 * Fast Decision Service
 * Provides rapid trading decisions using pre-computed signals and pattern matching
 * Bypasses slow AI calls for time-critical decisions
 */

import { CloudflareBindings } from '@/types';
import { TradingDecision, TradingAction } from '@/types/agents';
import { Position } from '@/types/trading';

interface FastSignal {
  symbol: string;
  action: TradingAction;
  confidence: number;
  ttl: number; // Time to live in ms
  timestamp: number;
}

interface MarketSnapshot {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  rsi?: number;
  macd?: number;
  bb?: { upper: number; middle: number; lower: number };
}

export class FastDecisionService {
  private env: CloudflareBindings;
  private signalCache: Map<string, FastSignal> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache
  private readonly DECISION_TIMEOUT = 100; // 100ms max decision time
  
  // Pre-computed thresholds for rapid decisions
  private readonly THRESHOLDS = {
    rsi: { oversold: 30, overbought: 70 },
    volumeSpike: 2.5, // 2.5x average volume
    priceMove: 0.02, // 2% move threshold
    spreadLimit: 0.001, // 0.1% max spread
    minConfidence: 0.65 // Minimum confidence to trade
  };

  constructor(env: CloudflareBindings) {
    this.env = env;
    // Pre-populate cache with common scenarios
    this.cacheCommonScenarios();
  }

  /**
   * Get ultra-fast trading decision (< 100ms)
   */
  async getQuickDecision(
    marketData: MarketSnapshot[],
    positions: Position[],
    dailyPnL: number
  ): Promise<TradingDecision> {
    const startTime = Date.now();
    
    try {
      // Check cached signals first (< 1ms)
      const cachedDecision = this.checkCachedSignals(marketData);
      if (cachedDecision) {
        return cachedDecision;
      }

      // Quick technical analysis (< 10ms)
      const technicalSignals = this.runQuickTechnicalAnalysis(marketData);
      
      // Risk check (< 5ms)
      const riskApproved = this.quickRiskCheck(positions, dailyPnL);
      
      // Pattern matching (< 20ms)
      const pattern = this.detectQuickPatterns(marketData);
      
      // Generate decision (< 5ms)
      const decision = this.synthesizeDecision(
        technicalSignals,
        riskApproved,
        pattern,
        marketData[0] // Primary symbol
      );

      // Cache the decision
      this.cacheSignal(decision, marketData);
      
      const elapsed = Date.now() - startTime;
      if (elapsed > this.DECISION_TIMEOUT) {
        console.warn(`Slow decision: ${elapsed}ms`);
      }

      return decision;
      
    } catch (error) {
      // On any error, return WAIT decision
      return this.getWaitDecision('Error in fast decision');
    }
  }

  /**
   * Check cached signals for instant response
   */
  private checkCachedSignals(marketData: MarketSnapshot[]): TradingDecision | null {
    const cacheKey = this.getCacheKey(marketData);
    const cached = this.signalCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return {
        id: `cached-${Date.now()}`,
        action: cached.action,
        symbol: cached.symbol,
        confidence: cached.confidence,
        metadata: { 
          source: 'cache',
          cacheHit: true,
          cacheKey,
          ttlRemaining: cached.ttl - (Date.now() - cached.timestamp)
        }
      };
    }
    
    // Check for common scenario caches
    const primary = marketData[0];
    if (primary.symbol === 'SPY') {
      if (primary.change > 0.01 && primary.rsi && primary.rsi < 70) {
        const bullishCache = this.signalCache.get('SPY_bullish_common');
        if (bullishCache && Date.now() - bullishCache.timestamp < bullishCache.ttl) {
          return {
            id: `cached-common-${Date.now()}`,
            action: bullishCache.action,
            symbol: bullishCache.symbol,
            confidence: bullishCache.confidence,
            metadata: { source: 'cache', scenario: 'common_bullish' }
          };
        }
      }
    }
    
    // Check for pre-computed signals
    const signalKey = `signal:${primary.symbol}:${TradingAction.ENTER_POSITION}`;
    const precomputedSignal = this.signalCache.get(signalKey);
    if (precomputedSignal && Date.now() - precomputedSignal.timestamp < precomputedSignal.ttl) {
      return {
        id: `precomputed-${Date.now()}`,
        action: precomputedSignal.action,
        symbol: precomputedSignal.symbol,
        confidence: precomputedSignal.confidence,
        metadata: { 
          source: 'precomputed',
          processingTime: 0 // Instant retrieval
        }
      };
    }
    
    return null;
  }

  /**
   * Ultra-fast technical analysis using simple indicators
   */
  private runQuickTechnicalAnalysis(marketData: MarketSnapshot[]): Record<string, number> {
    const signals: Record<string, number> = {};
    const primary = marketData[0];
    
    // Price momentum signal
    if (Math.abs(primary.change) > this.THRESHOLDS.priceMove) {
      signals.momentum = primary.change > 0 ? 1 : -1;
    }
    
    // RSI signal (if available)
    if (primary.rsi) {
      if (primary.rsi < this.THRESHOLDS.rsi.oversold) {
        signals.rsi = 1; // Bullish
      } else if (primary.rsi > this.THRESHOLDS.rsi.overbought) {
        signals.rsi = -1; // Bearish
      }
    }
    
    // Volume signal
    const avgVolume = marketData.reduce((sum, d) => sum + d.volume, 0) / marketData.length;
    if (primary.volume > avgVolume * this.THRESHOLDS.volumeSpike) {
      signals.volume = primary.change > 0 ? 1 : -1;
    }
    
    // Spread check
    const spread = (primary.ask - primary.bid) / primary.price;
    signals.spread = spread < this.THRESHOLDS.spreadLimit ? 1 : -1;
    
    return signals;
  }

  /**
   * Quick risk assessment
   */
  private quickRiskCheck(positions: Position[], dailyPnL: number): boolean {
    // Check daily P&L limits
    if (dailyPnL >= 300) return false; // Target reached
    if (dailyPnL <= -300) return false; // Stop loss hit
    
    // Check position limits
    if (positions.length >= 5) return false; // Max positions
    
    // Check exposure
    const totalExposure = positions.reduce((sum, pos) => 
      sum + Math.abs(parseFloat(pos.market_value)), 0
    );
    if (totalExposure > 50000) return false; // Max exposure
    
    return true;
  }

  /**
   * Detect simple patterns quickly
   */
  private detectQuickPatterns(marketData: MarketSnapshot[]): string | null {
    if (marketData.length < 3) return null;
    
    const prices = marketData.slice(0, 3).map(d => d.price);
    
    // Breakout pattern
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    const range = (highestPrice - lowestPrice) / lowestPrice;
    
    if (prices[0] > highestPrice * 0.995 && range > 0.01) {
      return 'breakout_up';
    }
    if (prices[0] < lowestPrice * 1.005 && range > 0.01) {
      return 'breakout_down';
    }
    
    // Mean reversion pattern
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
    const deviation = Math.abs(prices[0] - avgPrice) / avgPrice;
    
    if (deviation > 0.015) {
      return prices[0] > avgPrice ? 'overbought' : 'oversold';
    }
    
    return null;
  }

  /**
   * Get or create cache key for market conditions
   */
  private getCacheKey(marketData: MarketSnapshot[]): string {
    const primary = marketData[0];
    const key = `${primary.symbol}_${Math.floor(primary.price)}_${Math.floor(primary.change * 100)}_${primary.rsi || 0}`;
    return key;
  }

  /**
   * Cache commonly occurring scenarios for instant decisions
   */
  private cacheCommonScenarios(): void {
    // Common bullish scenario
    this.signalCache.set('SPY_bullish_common', {
      symbol: 'SPY',
      action: TradingAction.ENTER_POSITION,
      confidence: 0.75,
      ttl: 30000, // 30 seconds
      timestamp: Date.now()
    });

    // Common bearish scenario
    this.signalCache.set('SPY_bearish_common', {
      symbol: 'SPY', 
      action: TradingAction.EXIT_POSITION,
      confidence: 0.72,
      ttl: 30000,
      timestamp: Date.now()
    });

    // Sideways market scenario
    this.signalCache.set('SPY_neutral_common', {
      symbol: 'SPY',
      action: TradingAction.WAIT,
      confidence: 0.65,
      ttl: 30000,
      timestamp: Date.now()
    });
  }

  /**
   * Synthesize all signals into a decision
   */
  private synthesizeDecision(
    signals: Record<string, number>,
    riskApproved: boolean,
    pattern: string | null,
    marketData: MarketSnapshot
  ): TradingDecision {
    // Count bullish vs bearish signals
    let bullishCount = 0;
    let bearishCount = 0;
    
    Object.values(signals).forEach(signal => {
      if (signal > 0) bullishCount++;
      if (signal < 0) bearishCount++;
    });
    
    // Calculate confidence
    const totalSignals = bullishCount + bearishCount;
    const confidence = totalSignals > 0 ? 
      Math.max(bullishCount, bearishCount) / totalSignals : 0.5;
    
    // Determine action
    let action = TradingAction.WAIT;
    
    if (!riskApproved || confidence < this.THRESHOLDS.minConfidence) {
      action = TradingAction.WAIT;
    } else if (bullishCount > bearishCount && pattern !== 'overbought') {
      action = TradingAction.ENTER_POSITION;
    } else if (bearishCount > bullishCount && pattern !== 'oversold') {
      action = TradingAction.EXIT_POSITION;
    }
    
    // Special pattern overrides
    if (pattern === 'breakout_up' && riskApproved) {
      action = TradingAction.ENTER_POSITION;
    } else if (pattern === 'breakout_down') {
      action = TradingAction.EXIT_POSITION;
    }
    
    return {
      id: `fast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      symbol: marketData.symbol,
      confidence,
      metadata: {
        source: 'fast_decision',
        pattern,
        signals: Object.keys(signals).length,
        processingTime: Date.now()
      }
    };
  }

  /**
   * Cache signal for reuse
   */
  private cacheSignal(decision: TradingDecision, marketData: MarketSnapshot[]): void {
    const cacheKey = this.getCacheKey(marketData);
    this.signalCache.set(cacheKey, {
      symbol: decision.symbol,
      action: decision.action,
      confidence: decision.confidence,
      ttl: this.CACHE_TTL,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    this.cleanCache();
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, signal] of this.signalCache.entries()) {
      if (now - signal.timestamp > signal.ttl) {
        this.signalCache.delete(key);
      }
    }
  }

  /**
   * Get wait decision
   */
  private getWaitDecision(reason: string): TradingDecision {
    return {
      id: `wait-${Date.now()}`,
      action: TradingAction.WAIT,
      symbol: '',
      confidence: 0,
      metadata: { reason }
    };
  }

  /**
   * Pre-compute market indicators for speed
   */
  async precomputeIndicators(symbol: string): Promise<void> {
    try {
      // Fetch latest market data from cache or API
      const marketDataKey = `market:${symbol}:latest`;
      const cachedData = await this.env.CACHE.get(marketDataKey, 'json') as any;
      
      if (!cachedData) {
        console.log(`No market data available for ${symbol}`);
        return;
      }
      
      // Calculate technical indicators
      const rsi = await this.calculateRSI(symbol);
      const macd = await this.calculateMACD(symbol);
      const bb = await this.calculateBollingerBands(symbol);
      
      // Pre-compute common signal patterns
      const signals = this.generatePrecomputedSignals(cachedData, rsi, macd, bb);
      
      // Store pre-computed data
      const key = `indicators:${symbol}`;
      const indicators = {
        rsi,
        macd,
        bb,
        signals,
        price: cachedData.price,
        change: cachedData.change,
        volume: cachedData.volume,
        timestamp: Date.now()
      };
      
      await this.env.CACHE.put(key, JSON.stringify(indicators), {
        expirationTtl: 60 // 1 minute cache
      });
      
      console.log(`Pre-computed indicators for ${symbol}:`, {
        rsi,
        signalCount: signals.length
      });
    } catch (error) {
      console.error('Failed to precompute indicators:', error);
    }
  }
  
  /**
   * Generate pre-computed signals based on indicators
   */
  private generatePrecomputedSignals(
    marketData: any,
    rsi: number,
    macd: number,
    bb: any
  ): FastSignal[] {
    const signals: FastSignal[] = [];
    const { price, change } = marketData;
    
    // Oversold bounce signal
    if (rsi < 30 && price < bb.lower) {
      signals.push({
        symbol: marketData.symbol,
        action: TradingAction.ENTER_POSITION,
        confidence: 0.75,
        ttl: 30000,
        timestamp: Date.now()
      });
    }
    
    // Overbought reversal signal
    if (rsi > 70 && price > bb.upper) {
      signals.push({
        symbol: marketData.symbol,
        action: TradingAction.EXIT_POSITION,
        confidence: 0.72,
        ttl: 30000,
        timestamp: Date.now()
      });
    }
    
    // MACD crossover signal
    if (macd > 0 && change > 0.005) {
      signals.push({
        symbol: marketData.symbol,
        action: TradingAction.ENTER_POSITION,
        confidence: 0.68,
        ttl: 30000,
        timestamp: Date.now()
      });
    }
    
    // Store signals in cache for instant retrieval
    signals.forEach(signal => {
      const signalKey = `signal:${signal.symbol}:${signal.action}`;
      this.signalCache.set(signalKey, signal);
    });
    
    return signals;
  }

  // Placeholder methods for indicator calculations
  private async calculateRSI(symbol: string): Promise<number> {
    // In production, this would calculate actual RSI
    return 50 + (Math.random() - 0.5) * 40;
  }

  private async calculateMACD(symbol: string): Promise<number> {
    // In production, this would calculate actual MACD
    return (Math.random() - 0.5) * 2;
  }

  private async calculateBollingerBands(symbol: string): Promise<any> {
    // In production, this would calculate actual Bollinger Bands
    const price = 445 + (Math.random() - 0.5) * 10;
    return {
      upper: price * 1.02,
      middle: price,
      lower: price * 0.98
    };
  }
}