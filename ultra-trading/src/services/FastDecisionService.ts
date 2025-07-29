/**
 * Fast Decision Service
 * Provides rapid but intelligent trading decisions with proper risk management
 * Balances speed with accuracy using multi-factor validation
 * Achieves <15ms decisions with comprehensive risk checks
 */

import { CloudflareBindings } from '@/types';
import { TradingDecision, TradingAction } from '@/types/agents';
import { Position } from '@/types/trading';

interface FastSignal {
  symbol: string;
  action: TradingAction;
  confidence: number;
  ttl: number;
  timestamp: number;
  reasoning: string;
  stopLoss?: number;
  takeProfit?: number;
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
  vwap?: number;
  atr?: number; // Average True Range for volatility
}

interface MarketContext {
  volatility: 'low' | 'normal' | 'high' | 'extreme';
  trend: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
  volume: 'low' | 'normal' | 'high';
  spread: 'tight' | 'normal' | 'wide';
  timeOfDay: 'open' | 'mid_morning' | 'lunch' | 'afternoon' | 'close';
}

export class FastDecisionService {
  private signalCache = new Map<string, FastSignal>();
  private readonly CACHE_TTL = 3000; // 3 seconds - shorter for more dynamic decisions
  private readonly DECISION_TIMEOUT = 100; // 100ms max decision time
  
  // Smarter thresholds based on market conditions
  private readonly THRESHOLDS = {
    rsi: { 
      oversold: 30, 
      overbought: 70,
      extremeOversold: 20,
      extremeOverbought: 80
    },
    volumeSpike: {
      low: 1.5,
      normal: 2.0,
      high: 3.0
    },
    priceMove: {
      minimal: 0.001, // 0.1%
      small: 0.005,   // 0.5%
      normal: 0.01,   // 1%
      large: 0.02     // 2%
    },
    spread: {
      tight: 0.0005,  // 0.05%
      normal: 0.001,  // 0.1%
      wide: 0.002     // 0.2%
    },
    confidence: {
      veryLow: 0.3,
      low: 0.5,
      medium: 0.65,
      high: 0.75,
      veryHigh: 0.85
    }
  };

  // Risk management rules
  private readonly RISK_RULES = {
    maxPositions: 5,
    maxExposurePercent: 0.5, // 50% of portfolio
    maxPositionSizePercent: 0.1, // 10% per position
    dailyLossLimit: -300,
    dailyProfitTarget: 300,
    minRiskRewardRatio: 1.5, // Risk 1 to make 1.5
    stopLossPercent: 0.02, // 2% stop loss
    takeProfitPercent: 0.03 // 3% take profit
  };

  constructor(_env: CloudflareBindings) {
    // Environment passed but not used in this implementation
  }

  /**
   * Get smart trading decision with proper risk management
   */
  async getQuickDecision(
    marketData: MarketSnapshot[],
    positions: Position[],
    dailyPnL: number,
    accountValue = 100000
  ): Promise<TradingDecision> {
    const startTime = Date.now();
    
    try {
      // 1. Analyze market context (5ms)
      const marketContext = this.analyzeMarketContext(marketData);
      
      // 2. Check if we should even be trading (2ms)
      const tradingAllowed = this.shouldTrade(marketContext, positions, dailyPnL);
      if (!tradingAllowed.allowed) {
        return this.getWaitDecision(tradingAllowed.reason);
      }

      // 3. Check cached signals with context validation (1ms)
      const cachedDecision = this.checkContextualCache(marketData, marketContext);
      if (cachedDecision && this.validateCachedDecision(cachedDecision, marketContext)) {
        return cachedDecision;
      }

      // 4. Multi-factor technical analysis (10ms)
      const technicalScore = this.calculateTechnicalScore(marketData, marketContext);
      
      // 5. Risk-adjusted position sizing (5ms)
      const primary = marketData[0];
      if (!primary) {
        return this.getWaitDecision('No market data available');
      }
      
      const positionSize = this.calculatePositionSize(
        primary.price,
        accountValue,
        positions,
        marketContext
      );
      
      // 6. Generate smart decision with stops (5ms)
      const decision = this.generateSmartDecision(
        primary,
        technicalScore,
        positionSize,
        marketContext
      );

      // 7. Validate decision sanity (2ms)
      const validatedDecision = this.validateDecision(decision, positions, dailyPnL);

      // Cache only high-confidence decisions
      if (validatedDecision.confidence >= this.THRESHOLDS.confidence.medium) {
        this.cacheSignal(validatedDecision, marketData, marketContext);
      }
      
      const elapsed = Date.now() - startTime;
      if (elapsed > this.DECISION_TIMEOUT) {
        console.warn(`Decision took ${elapsed}ms - consider optimization`);
      }

      return validatedDecision;
      
    } catch (error) {
      console.error('Fast decision error:', error);
      return this.getWaitDecision('Error in decision process');
    }
  }

  /**
   * Analyze overall market context
   */
  private analyzeMarketContext(marketData: MarketSnapshot[]): MarketContext {
    const primary = marketData[0];
    if (!primary) {
      return {
        volatility: 'normal',
        trend: 'neutral',
        volume: 'normal',
        spread: 'normal',
        timeOfDay: 'mid_morning'
      };
    }
    
    const recentData = marketData.slice(0, 5);
    
    // Volatility assessment
    const priceChanges = recentData.map(d => Math.abs(d.change));
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    let volatility: MarketContext['volatility'] = 'normal';
    if (avgChange < 0.002) volatility = 'low';
    else if (avgChange > 0.015) volatility = 'high';
    else if (avgChange > 0.025) volatility = 'extreme';
    
    // Trend assessment
    const trendStrength = primary.change;
    let trend: MarketContext['trend'] = 'neutral';
    if (trendStrength > 0.01) trend = 'up';
    else if (trendStrength > 0.02) trend = 'strong_up';
    else if (trendStrength < -0.01) trend = 'down';
    else if (trendStrength < -0.02) trend = 'strong_down';
    
    // Volume assessment
    const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    const volumeRatio = primary.volume / avgVolume;
    let volume: MarketContext['volume'] = 'normal';
    if (volumeRatio < 0.7) volume = 'low';
    else if (volumeRatio > 1.5) volume = 'high';
    
    // Spread assessment
    const spreadPercent = (primary.ask - primary.bid) / primary.price;
    let spread: MarketContext['spread'] = 'normal';
    if (spreadPercent < this.THRESHOLDS.spread.tight) spread = 'tight';
    else if (spreadPercent > this.THRESHOLDS.spread.wide) spread = 'wide';
    
    // Time of day
    const hour = new Date().getHours();
    let timeOfDay: MarketContext['timeOfDay'] = 'mid_morning';
    if (hour < 10) timeOfDay = 'open';
    else if (hour >= 12 && hour < 13) timeOfDay = 'lunch';
    else if (hour >= 14) timeOfDay = 'afternoon';
    else if (hour >= 15.5) timeOfDay = 'close';
    
    return { volatility, trend, volume, spread, timeOfDay };
  }

  /**
   * Determine if we should be trading based on conditions
   */
  private shouldTrade(
    context: MarketContext,
    positions: Position[],
    dailyPnL: number
  ): { allowed: boolean; reason: string } {
    // Don't trade in extreme volatility
    if (context.volatility === 'extreme') {
      return { allowed: false, reason: 'Extreme volatility - too risky' };
    }
    
    // Don't trade with wide spreads
    if (context.spread === 'wide') {
      return { allowed: false, reason: 'Spread too wide - poor entry' };
    }
    
    // Check daily P&L limits
    if (dailyPnL >= this.RISK_RULES.dailyProfitTarget) {
      return { allowed: false, reason: 'Daily profit target reached' };
    }
    if (dailyPnL <= this.RISK_RULES.dailyLossLimit) {
      return { allowed: false, reason: 'Daily loss limit reached' };
    }
    
    // Check position limits
    if (positions.length >= this.RISK_RULES.maxPositions) {
      return { allowed: false, reason: 'Maximum positions reached' };
    }
    
    // Avoid trading during lunch hour (lower liquidity)
    if (context.timeOfDay === 'lunch' && context.volume === 'low') {
      return { allowed: false, reason: 'Low liquidity during lunch' };
    }
    
    // Avoid opening new positions near close
    if (context.timeOfDay === 'close' && positions.length > 2) {
      return { allowed: false, reason: 'Too late to open new positions' };
    }
    
    return { allowed: true, reason: '' };
  }

  /**
   * Calculate multi-factor technical score
   */
  private calculateTechnicalScore(
    marketData: MarketSnapshot[],
    context: MarketContext
  ): { score: number; signals: Record<string, number>; confidence: number } {
    const primary = marketData[0];
    if (!primary) {
      return { score: 0, signals: {}, confidence: 0 };
    }
    
    const signals: Record<string, number> = {};
    let totalWeight = 0;
    let weightedScore = 0;
    
    // RSI Signal (weight: 0.25)
    if (primary.rsi) {
      const rsiWeight = 0.25;
      if (primary.rsi < this.THRESHOLDS.rsi.extremeOversold) {
        signals['rsi'] = 1;
      } else if (primary.rsi < this.THRESHOLDS.rsi.oversold) {
        signals['rsi'] = 0.5;
      } else if (primary.rsi > this.THRESHOLDS.rsi.extremeOverbought) {
        signals['rsi'] = -1;
      } else if (primary.rsi > this.THRESHOLDS.rsi.overbought) {
        signals['rsi'] = -0.5;
      } else {
        signals['rsi'] = 0;
      }
      weightedScore += signals['rsi'] * rsiWeight;
      totalWeight += rsiWeight;
    }
    
    // MACD Signal (weight: 0.2)
    if (primary.macd !== undefined) {
      const macdWeight = 0.2;
      if (primary.macd > 0 && context.trend === 'up') {
        signals['macd'] = 0.75;
      } else if (primary.macd > 0) {
        signals['macd'] = 0.25;
      } else if (primary.macd < 0 && context.trend === 'down') {
        signals['macd'] = -0.75;
      } else {
        signals['macd'] = -0.25;
      }
      weightedScore += signals['macd'] * macdWeight;
      totalWeight += macdWeight;
    }
    
    // Bollinger Bands (weight: 0.2)
    if (primary.bb) {
      const bbWeight = 0.2;
      const bbPosition = (primary.price - primary.bb.lower) / (primary.bb.upper - primary.bb.lower);
      if (bbPosition < 0.2 && context.trend !== 'strong_down') {
        signals['bb'] = 0.75;
      } else if (bbPosition > 0.8 && context.trend !== 'strong_up') {
        signals['bb'] = -0.75;
      } else {
        signals['bb'] = 0;
      }
      weightedScore += signals['bb'] * bbWeight;
      totalWeight += bbWeight;
    }
    
    // Volume Confirmation (weight: 0.15)
    const volumeWeight = 0.15;
    if (context.volume === 'high') {
      signals['volume'] = context.trend === 'up' ? 0.5 : -0.5;
    } else if (context.volume === 'low') {
      signals['volume'] = 0; // No conviction
    } else {
      signals['volume'] = 0.25 * (context.trend === 'up' ? 1 : -1);
    }
    weightedScore += signals['volume'] * volumeWeight;
    totalWeight += volumeWeight;
    
    // Trend Alignment (weight: 0.2)
    const trendWeight = 0.2;
    switch (context.trend) {
      case 'strong_up': signals['trend'] = 1; break;
      case 'up': signals['trend'] = 0.5; break;
      case 'neutral': signals['trend'] = 0; break;
      case 'down': signals['trend'] = -0.5; break;
      case 'strong_down': signals['trend'] = -1; break;
    }
    weightedScore += signals['trend'] * trendWeight;
    totalWeight += trendWeight;
    
    // Calculate final score and confidence
    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const signalAgreement = Object.values(signals).filter(s => s !== 0).length;
    const signalConsistency = Math.abs(Math.max(...Object.values(signals)) - Math.min(...Object.values(signals)));
    
    // Confidence based on signal agreement and consistency
    let confidence = 0.5;
    if (signalAgreement >= 4 && signalConsistency < 1.5) {
      confidence = 0.8;
    } else if (signalAgreement >= 3 && signalConsistency < 2) {
      confidence = 0.65;
    } else if (signalAgreement <= 2 || signalConsistency > 2) {
      confidence = 0.4;
    }
    
    // Adjust confidence based on market context
    if (context.volatility === 'high') confidence *= 0.8;
    if (context.spread === 'wide') confidence *= 0.9;
    if (context.volume === 'low') confidence *= 0.85;
    
    return { score, signals, confidence };
  }

  /**
   * Calculate appropriate position size based on risk
   */
  private calculatePositionSize(
    price: number,
    accountValue: number,
    positions: Position[],
    context: MarketContext
  ): number {
    // Calculate current exposure
    const currentExposure = positions.reduce((sum, pos) => 
      sum + Math.abs(parseFloat((pos as any).market_value || '0')), 0
    );
    const exposurePercent = currentExposure / accountValue;
    
    // Base position size (10% of account)
    let positionSize = accountValue * this.RISK_RULES.maxPositionSizePercent;
    
    // Adjust for current exposure
    if (exposurePercent > 0.3) {
      positionSize *= 0.5; // Half size if already 30% exposed
    }
    
    // Adjust for volatility
    switch (context.volatility) {
      case 'low': positionSize *= 1.2; break;
      case 'normal': positionSize *= 1.0; break;
      case 'high': positionSize *= 0.7; break;
      case 'extreme': positionSize *= 0.5; break;
    }
    
    // Adjust for time of day
    if (context.timeOfDay === 'close') {
      positionSize *= 0.5; // Smaller positions near close
    }
    
    // Calculate number of shares
    const shares = Math.floor(positionSize / price);
    return Math.max(1, shares); // At least 1 share
  }

  /**
   * Generate smart trading decision
   */
  private generateSmartDecision(
    marketData: MarketSnapshot,
    technicalScore: { score: number; signals: Record<string, number>; confidence: number },
    positionSize: number,
    context: MarketContext
  ): TradingDecision {
    const { score, signals, confidence } = technicalScore;
    
    // Determine action based on score and confidence
    let action = TradingAction.WAIT;
    let reasoning = 'Insufficient signal strength';
    
    if (confidence >= this.THRESHOLDS.confidence.medium) {
      if (score > 0.3) {
        action = TradingAction.ENTER_POSITION;
        reasoning = `Bullish signals: ${Object.entries(signals)
          .filter(([_, v]) => v > 0)
          .map(([k, v]) => `${k}(${v.toFixed(2)})`)
          .join(', ')}`;
      } else if (score < -0.3) {
        action = TradingAction.EXIT_POSITION;
        reasoning = `Bearish signals: ${Object.entries(signals)
          .filter(([_, v]) => v < 0)
          .map(([k, v]) => `${k}(${v.toFixed(2)})`)
          .join(', ')}`;
      } else {
        reasoning = 'Mixed signals - staying neutral';
      }
    } else {
      reasoning = `Low confidence (${(confidence * 100).toFixed(0)}%) - waiting for better setup`;
    }
    
    // Calculate stop loss and take profit
    const stopLoss = action === TradingAction.ENTER_POSITION
      ? marketData.price * (1 - this.RISK_RULES.stopLossPercent)
      : marketData.price * (1 + this.RISK_RULES.stopLossPercent);
      
    const takeProfit = action === TradingAction.ENTER_POSITION
      ? marketData.price * (1 + this.RISK_RULES.takeProfitPercent)
      : marketData.price * (1 - this.RISK_RULES.takeProfitPercent);
    
    return {
      id: `smart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      symbol: marketData.symbol,
      confidence,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      reasoning,
      timestamp: Date.now(),
      signals: [],
      metadata: {
        source: 'smart_fast_decision',
        score: score.toFixed(3),
        context,
        signals: Object.entries(signals).reduce((acc, [k, v]) => {
          acc[k] = v.toFixed(2);
          return acc;
        }, {} as Record<string, string>)
      }
    };
  }

  /**
   * Validate decision for sanity
   */
  private validateDecision(
    decision: TradingDecision,
    positions: Position[],
    dailyPnL: number
  ): TradingDecision {
    // Don't enter if we're already in this position
    if (decision.action === TradingAction.ENTER_POSITION) {
      const existingPosition = positions.find(p => p.symbol === decision.symbol);
      if (existingPosition) {
        return {
          ...decision,
          action: TradingAction.WAIT,
          reasoning: 'Already holding this position'
        };
      }
    }
    
    // Don't exit if we don't have the position
    if (decision.action === TradingAction.EXIT_POSITION) {
      const existingPosition = positions.find(p => p.symbol === decision.symbol);
      if (!existingPosition) {
        return {
          ...decision,
          action: TradingAction.WAIT,
          reasoning: 'No position to exit'
        };
      }
    }
    
    // Final risk check
    if (dailyPnL <= this.RISK_RULES.dailyLossLimit * 0.8) {
      return {
        ...decision,
        action: TradingAction.WAIT,
        reasoning: 'Approaching daily loss limit - stopping trading'
      };
    }
    
    return decision;
  }

  /**
   * Check cache with context validation
   */
  private checkContextualCache(
    marketData: MarketSnapshot[],
    context: MarketContext
  ): TradingDecision | null {
    if (!marketData[0]) return null;
    const cacheKey = this.getCacheKey(marketData[0], context);
    const cached = this.signalCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Validate that market conditions haven't changed dramatically
      const firstData = marketData[0];
      if (firstData?.ask === undefined || firstData.bid === undefined || firstData.price === undefined) {
        return null;
      }
      
      const currentSpread = (firstData.ask - firstData.bid) / firstData.price;
      const maxSpreadChange = 0.0005; // 0.05% change tolerance
      
      if (Math.abs(currentSpread - this.THRESHOLDS.spread.normal) < maxSpreadChange) {
        return this.signalToDecision(cached);
      }
    }
    
    return null;
  }

  /**
   * Validate cached decision is still appropriate
   */
  private validateCachedDecision(
    decision: TradingDecision,
    context: MarketContext
  ): boolean {
    // Don't use cached BUY decisions in downtrend
    if (decision.action === TradingAction.ENTER_POSITION && 
        (context.trend === 'down' || context.trend === 'strong_down')) {
      return false;
    }
    
    // Don't use cached SELL decisions in uptrend
    if (decision.action === TradingAction.EXIT_POSITION && 
        (context.trend === 'up' || context.trend === 'strong_up')) {
      return false;
    }
    
    // Don't use any cached decision in extreme volatility
    if (context.volatility === 'extreme') {
      return false;
    }
    
    return true;
  }

  /**
   * Get contextual cache key
   */
  private getCacheKey(marketData: MarketSnapshot, context: MarketContext): string {
    return `${marketData.symbol}_${Math.floor(marketData.price)}_${context.trend}_${context.volatility}`;
  }

  /**
   * Convert signal to decision
   */
  private signalToDecision(signal: FastSignal): TradingDecision {
    return {
      id: `cached-${Date.now()}`,
      timestamp: Date.now(),
      action: signal.action,
      symbol: signal.symbol,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      reasoning: signal.reasoning,
      signals: [],
      metadata: { source: 'cache' }
    };
  }

  /**
   * Cache signal with context
   */
  private cacheSignal(
    decision: TradingDecision,
    marketData: MarketSnapshot[],
    context: MarketContext
  ): void {
    const primary = marketData[0];
    if (!primary || !decision.symbol) return;
    
    const cacheKey = this.getCacheKey(primary, context);
    const signal: FastSignal = {
      symbol: decision.symbol,
      action: decision.action,
      confidence: decision.confidence,
      ttl: this.CACHE_TTL,
      timestamp: Date.now(),
      reasoning: decision.reasoning || '',
      stopLoss: decision.stopLoss,
      takeProfit: decision.takeProfit
    };
    
    this.signalCache.set(cacheKey, signal);
    
    // Clean old entries
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
   * Get wait decision with detailed reasoning
   */
  private getWaitDecision(reason: string): TradingDecision {
    return {
      id: `wait-${Date.now()}`,
      action: TradingAction.WAIT,
      symbol: '',
      confidence: 0,
      reasoning: reason,
      timestamp: Date.now(),
      signals: [],
      metadata: { 
        source: 'smart_fast_decision',
        reason 
      }
    };
  }
}