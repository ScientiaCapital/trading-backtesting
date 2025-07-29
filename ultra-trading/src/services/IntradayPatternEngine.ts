/**
 * Intraday Pattern Engine
 * High-frequency pattern detection for scalping opportunities
 */

import { CloudflareBindings } from '@/types';
import { MarketData } from '@/types/strategy';
import { createLogger } from '@/utils';

export interface IntradayPattern {
  type: PatternType;
  symbol: string;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export enum PatternType {
  OPENING_RANGE_BREAKOUT = 'OPENING_RANGE_BREAKOUT',
  VWAP_BAND_BOUNCE = 'VWAP_BAND_BOUNCE',
  MOMENTUM_IGNITION = 'MOMENTUM_IGNITION',
  MEAN_REVERSION = 'MEAN_REVERSION',
  SUPPORT_RESISTANCE = 'SUPPORT_RESISTANCE',
  BULL_FLAG = 'BULL_FLAG',
  BEAR_FLAG = 'BEAR_FLAG',
  DOUBLE_BOTTOM = 'DOUBLE_BOTTOM',
  DOUBLE_TOP = 'DOUBLE_TOP'
}

interface MarketBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  vwap?: number;
}

interface OpeningRange {
  symbol: string;
  high: number;
  low: number;
  volume: number;
  established: boolean;
  timestamp: Date;
}

interface SupportResistanceLevel {
  price: number;
  strength: number; // 1-10
  touches: number;
  type: 'support' | 'resistance';
  lastTested: Date;
}

export class IntradayPatternEngine {
  private logger: ReturnType<typeof createLogger>;
  private openingRanges = new Map<string, OpeningRange>();
  private supportResistanceLevels = new Map<string, SupportResistanceLevel[]>();
  private patternCache = new Map<string, IntradayPattern[]>();
  
  // Pattern detection thresholds
  private readonly BREAKOUT_VOLUME_MULTIPLIER = 2.5;
  private readonly VWAP_BAND_WIDTH = 0.005; // 0.5%
  private readonly MOMENTUM_PRICE_THRESHOLD = 0.01; // 1% move
  private readonly MOMENTUM_VOLUME_THRESHOLD = 3; // 3x average
  private readonly RSI_OVERSOLD = 20;
  private readonly RSI_OVERBOUGHT = 80;
  private readonly MIN_PATTERN_CONFIDENCE = 0.65;

  constructor(env: CloudflareBindings) {
    this.logger = createLogger({ env } as any);
  }

  /**
   * Detect all patterns for given market data
   */
  async detectPatterns(
    marketData: MarketData[],
    bars: MarketBar[]
  ): Promise<IntradayPattern[]> {
    const patterns: IntradayPattern[] = [];
    const symbol = marketData[0]?.symbol;
    
    if (!symbol || marketData.length === 0) return patterns;

    try {
      // Run all pattern detectors in parallel
      const [
        openingRange,
        vwapBands,
        momentum,
        meanReversion,
        supportResistance
      ] = await Promise.all([
        this.detectOpeningRangeBreakout(symbol, bars),
        this.detectVWAPBands(symbol, marketData, bars),
        this.detectMomentumIgnition(symbol, marketData, bars),
        this.detectMeanReversion(symbol, marketData),
        this.detectSupportResistance(symbol, bars)
      ]);

      // Collect valid patterns
      const allPatterns = [
        openingRange,
        vwapBands,
        momentum,
        meanReversion,
        supportResistance
      ].filter((p): p is IntradayPattern => p !== null && p.confidence >= this.MIN_PATTERN_CONFIDENCE);

      patterns.push(...allPatterns);

      // Cache patterns
      this.patternCache.set(symbol, patterns);
      
      return patterns;
    } catch (error) {
      this.logger.error('Pattern detection failed', { symbol, error });
      return [];
    }
  }

  /**
   * Detect opening range breakout pattern
   */
  private async detectOpeningRangeBreakout(
    symbol: string,
    bars: MarketBar[]
  ): Promise<IntradayPattern | null> {
    const now = new Date();
    const marketOpen = new Date(now);
    marketOpen.setHours(9, 30, 0, 0);
    
    // Check if we're past opening range period (first 30 minutes)
    const minutesSinceOpen = (now.getTime() - marketOpen.getTime()) / 60000;
    if (minutesSinceOpen < 30 || minutesSinceOpen > 390) return null;

    // Get or establish opening range
    let range = this.openingRanges.get(symbol);
    
    if (!range?.established) {
      // Calculate opening range from first 30 minutes
      const openingBars = bars.filter(bar => {
        const barTime = new Date(bar.timestamp);
        const barMinutes = (barTime.getTime() - marketOpen.getTime()) / 60000;
        return barMinutes >= 0 && barMinutes <= 30;
      });

      if (openingBars.length < 5) return null; // Need sufficient data

      const high = Math.max(...openingBars.map(b => b.high));
      const low = Math.min(...openingBars.map(b => b.low));
      const volume = openingBars.reduce((sum, b) => sum + b.volume, 0);

      range = {
        symbol,
        high,
        low,
        volume,
        established: true,
        timestamp: now
      };
      
      this.openingRanges.set(symbol, range);
    }

    // Check for breakout
    const currentBar = bars[bars.length - 1];
    if (!currentBar) return null;

    const avgVolume = bars.slice(-20).reduce((sum, b) => sum + b.volume, 0) / 20;
    const volumeRatio = currentBar.volume / avgVolume;

    // Bullish breakout
    if (currentBar.close > range.high && volumeRatio > this.BREAKOUT_VOLUME_MULTIPLIER) {
      return {
        type: PatternType.OPENING_RANGE_BREAKOUT,
        symbol,
        confidence: this.calculateBreakoutConfidence(
          currentBar.close,
          range.high,
          volumeRatio
        ),
        entryPrice: currentBar.close,
        stopLoss: range.low,
        takeProfit: currentBar.close + (range.high - range.low) * 2, // 2:1 R/R
        timeframe: '30min',
        timestamp: now,
        metadata: {
          rangeHigh: range.high,
          rangeLow: range.low,
          volumeRatio,
          breakoutDirection: 'bullish'
        }
      };
    }

    // Bearish breakout
    if (currentBar.close < range.low && volumeRatio > this.BREAKOUT_VOLUME_MULTIPLIER) {
      return {
        type: PatternType.OPENING_RANGE_BREAKOUT,
        symbol,
        confidence: this.calculateBreakoutConfidence(
          currentBar.close,
          range.low,
          volumeRatio
        ),
        entryPrice: currentBar.close,
        stopLoss: range.high,
        takeProfit: currentBar.close - (range.high - range.low) * 2,
        timeframe: '30min',
        timestamp: now,
        metadata: {
          rangeHigh: range.high,
          rangeLow: range.low,
          volumeRatio,
          breakoutDirection: 'bearish'
        }
      };
    }

    return null;
  }

  /**
   * Detect VWAP band trading opportunities
   */
  private async detectVWAPBands(
    symbol: string,
    marketData: MarketData[],
    bars: MarketBar[]
  ): Promise<IntradayPattern | null> {
    if (bars.length < 20) return null;

    // Calculate VWAP
    const vwap = this.calculateVWAP(bars);
    const currentPrice = marketData[0]?.close;
    if (!currentPrice) return null;

    // Calculate bands
    const upperBand = vwap * (1 + this.VWAP_BAND_WIDTH);
    const lowerBand = vwap * (1 - this.VWAP_BAND_WIDTH);

    // Check for band touches with reversal
    const recentBars = bars.slice(-3);
    const touchedUpper = recentBars.some(b => b.high >= upperBand);
    const touchedLower = recentBars.some(b => b.low <= lowerBand);

    // Mean reversion from upper band
    if (touchedUpper && currentPrice < upperBand) {
      return {
        type: PatternType.VWAP_BAND_BOUNCE,
        symbol,
        confidence: 0.7,
        entryPrice: currentPrice,
        stopLoss: upperBand * 1.002, // Just above band
        takeProfit: vwap,
        timeframe: '5min',
        timestamp: new Date(),
        metadata: {
          vwap,
          upperBand,
          lowerBand,
          direction: 'short'
        }
      };
    }

    // Mean reversion from lower band
    if (touchedLower && currentPrice > lowerBand) {
      return {
        type: PatternType.VWAP_BAND_BOUNCE,
        symbol,
        confidence: 0.7,
        entryPrice: currentPrice,
        stopLoss: lowerBand * 0.998,
        takeProfit: vwap,
        timeframe: '5min',
        timestamp: new Date(),
        metadata: {
          vwap,
          upperBand,
          lowerBand,
          direction: 'long'
        }
      };
    }

    return null;
  }

  /**
   * Detect momentum ignition patterns
   */
  private async detectMomentumIgnition(
    symbol: string,
    _marketData: MarketData[],
    bars: MarketBar[]
  ): Promise<IntradayPattern | null> {
    if (bars.length < 10) return null;

    const currentBar = bars[bars.length - 1];
    const prevBars = bars.slice(-10, -1);
    
    if (!currentBar || prevBars.length === 0) return null;
    
    // Calculate average volume
    const avgVolume = prevBars.reduce((sum, b) => sum + b.volume, 0) / prevBars.length;
    const volumeRatio = currentBar.volume / avgVolume;

    // Calculate price move
    const lastPrevBar = prevBars[prevBars.length - 1];
    if (!lastPrevBar) return null;
    
    const priceMove = (currentBar.close - lastPrevBar.close) / lastPrevBar.close;

    // Check for momentum ignition
    if (Math.abs(priceMove) > this.MOMENTUM_PRICE_THRESHOLD && 
        volumeRatio > this.MOMENTUM_VOLUME_THRESHOLD) {
      
      const direction = priceMove > 0 ? 'bullish' : 'bearish';
      const atr = this.calculateATR(bars, 14);
      
      return {
        type: PatternType.MOMENTUM_IGNITION,
        symbol,
        confidence: this.calculateMomentumConfidence(priceMove, volumeRatio),
        entryPrice: currentBar.close,
        stopLoss: direction === 'bullish' ? 
          currentBar.close - atr * 1.5 : 
          currentBar.close + atr * 1.5,
        takeProfit: direction === 'bullish' ? 
          currentBar.close + atr * 3 : 
          currentBar.close - atr * 3,
        timeframe: '1min',
        timestamp: new Date(),
        metadata: {
          priceMove: (priceMove * 100).toFixed(2) + '%',
          volumeRatio,
          direction,
          atr
        }
      };
    }

    return null;
  }

  /**
   * Detect mean reversion setups
   */
  private async detectMeanReversion(
    symbol: string,
    marketData: MarketData[]
  ): Promise<IntradayPattern | null> {
    const current = marketData[0];
    if (!current) return null;

    // Calculate RSI from recent price data
    const rsi = this.calculateRSI(marketData);
    if (!rsi) return null;
    
    const price = current.close || current.price;

    // Oversold bounce
    if (rsi < this.RSI_OVERSOLD) {
      return {
        type: PatternType.MEAN_REVERSION,
        symbol,
        confidence: this.calculateMeanReversionConfidence(rsi, true),
        entryPrice: price,
        stopLoss: price * 0.98, // 2% stop
        takeProfit: price * 1.015, // 1.5% target
        timeframe: '1min',
        timestamp: new Date(),
        metadata: {
          rsi,
          condition: 'oversold',
          expectedMove: 'bounce'
        }
      };
    }

    // Overbought reversal
    if (rsi > this.RSI_OVERBOUGHT) {
      return {
        type: PatternType.MEAN_REVERSION,
        symbol,
        confidence: this.calculateMeanReversionConfidence(rsi, false),
        entryPrice: price,
        stopLoss: price * 1.02,
        takeProfit: price * 0.985,
        timeframe: '1min',
        timestamp: new Date(),
        metadata: {
          rsi,
          condition: 'overbought',
          expectedMove: 'pullback'
        }
      };
    }

    return null;
  }

  /**
   * Detect support and resistance levels
   */
  private async detectSupportResistance(
    symbol: string,
    bars: MarketBar[]
  ): Promise<IntradayPattern | null> {
    if (bars.length < 50) return null;

    // Update S/R levels
    this.updateSupportResistanceLevels(symbol, bars);
    
    const levels = this.supportResistanceLevels.get(symbol) || [];
    
    // Check if we have bars data
    if (bars.length === 0) {
      return null;
    }
    
    const lastBar = bars[bars.length - 1];
    if (!lastBar) {
      return null;
    }
    
    const currentPrice = lastBar.close;
    
    // Find nearest levels
    const nearestSupport = levels
      .filter(l => l.type === 'support' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price)[0];
      
    const nearestResistance = levels
      .filter(l => l.type === 'resistance' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price)[0];

    // Check for support bounce
    if (nearestSupport && 
        Math.abs(currentPrice - nearestSupport.price) / currentPrice < 0.002 &&
        nearestSupport.strength >= 5) {
      return {
        type: PatternType.SUPPORT_RESISTANCE,
        symbol,
        confidence: nearestSupport.strength / 10,
        entryPrice: currentPrice,
        stopLoss: nearestSupport.price * 0.998,
        takeProfit: nearestResistance?.price || currentPrice * 1.01,
        timeframe: '5min',
        timestamp: new Date(),
        metadata: {
          level: nearestSupport.price,
          levelType: 'support',
          strength: nearestSupport.strength,
          touches: nearestSupport.touches
        }
      };
    }

    // Check for resistance rejection
    if (nearestResistance && 
        Math.abs(currentPrice - nearestResistance.price) / currentPrice < 0.002 &&
        nearestResistance.strength >= 5) {
      return {
        type: PatternType.SUPPORT_RESISTANCE,
        symbol,
        confidence: nearestResistance.strength / 10,
        entryPrice: currentPrice,
        stopLoss: nearestResistance.price * 1.002,
        takeProfit: nearestSupport?.price || currentPrice * 0.99,
        timeframe: '5min',
        timestamp: new Date(),
        metadata: {
          level: nearestResistance.price,
          levelType: 'resistance',
          strength: nearestResistance.strength,
          touches: nearestResistance.touches
        }
      };
    }

    return null;
  }

  /**
   * Update support and resistance levels
   */
  private updateSupportResistanceLevels(symbol: string, bars: MarketBar[]): void {
    const levels: SupportResistanceLevel[] = [];
    const pricePoints = new Map<number, number>();

    // Round prices to nearest 0.10 for clustering
    bars.forEach(bar => {
      const roundedHigh = Math.round(bar.high * 10) / 10;
      const roundedLow = Math.round(bar.low * 10) / 10;
      
      pricePoints.set(roundedHigh, (pricePoints.get(roundedHigh) || 0) + 1);
      pricePoints.set(roundedLow, (pricePoints.get(roundedLow) || 0) + 1);
    });

    // Find levels with multiple touches
    pricePoints.forEach((touches, price) => {
      if (touches >= 3) {
        // Ensure we have bars before accessing
        const lastBar = bars[bars.length - 1];
        if (!lastBar) return;
        
        const currentPrice = lastBar.close;
        const type = price > currentPrice ? 'resistance' : 'support';
        
        levels.push({
          price,
          strength: Math.min(touches, 10),
          touches,
          type,
          lastTested: new Date()
        });
      }
    });

    // Sort by strength
    levels.sort((a, b) => b.strength - a.strength);
    
    // Keep top 10 levels
    this.supportResistanceLevels.set(symbol, levels.slice(0, 10));
  }

  /**
   * Calculate VWAP
   */
  private calculateVWAP(bars: MarketBar[]): number {
    let cumulativeTPV = 0; // Total Price * Volume
    let cumulativeVolume = 0;

    bars.forEach(bar => {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      cumulativeTPV += typicalPrice * bar.volume;
      cumulativeVolume += bar.volume;
    });

    if (cumulativeVolume > 0) {
      return cumulativeTPV / cumulativeVolume;
    }
    
    // Fallback to last close price if available
    const lastBar = bars[bars.length - 1];
    return lastBar ? lastBar.close : 0;
  }

  /**
   * Calculate RSI from market data
   */
  private calculateRSI(marketData: MarketData[], period = 14): number | null {
    if (marketData.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const current = marketData[i];
      const previous = marketData[i - 1];
      
      if (!current || !previous) continue;
      
      const currentPrice = current.close ?? current.price;
      const previousPrice = previous.close ?? previous.price;
      
      if (currentPrice === undefined || previousPrice === undefined) continue;
      
      const change = currentPrice - previousPrice;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100; // No losses = RSI 100

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(bars: MarketBar[], period = 14): number {
    if (bars.length < period + 1) return 0;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < bars.length; i++) {
      const currentBar = bars[i];
      const prevBar = bars[i - 1];
      
      if (!currentBar || !prevBar) continue;
      
      const high = currentBar.high ?? 0;
      const low = currentBar.low ?? 0;
      const prevClose = prevBar.close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }

    // Simple moving average of true ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
  }

  /**
   * Calculate breakout confidence
   */
  private calculateBreakoutConfidence(
    breakoutPrice: number,
    rangeLevel: number,
    volumeRatio: number
  ): number {
    const priceStrength = Math.abs(breakoutPrice - rangeLevel) / rangeLevel;
    const volumeStrength = Math.min(volumeRatio / 5, 1); // Cap at 5x
    
    return 0.5 + (priceStrength * 0.25) + (volumeStrength * 0.25);
  }

  /**
   * Calculate momentum confidence
   */
  private calculateMomentumConfidence(priceMove: number, volumeRatio: number): number {
    const priceStrength = Math.min(Math.abs(priceMove) / 0.03, 1); // Cap at 3%
    const volumeStrength = Math.min(volumeRatio / 5, 1);
    
    return 0.5 + (priceStrength * 0.3) + (volumeStrength * 0.2);
  }

  /**
   * Calculate mean reversion confidence
   */
  private calculateMeanReversionConfidence(rsi: number, isOversold: boolean): number {
    if (isOversold) {
      return 0.5 + ((30 - rsi) / 30) * 0.5; // More extreme = higher confidence
    } else {
      return 0.5 + ((rsi - 70) / 30) * 0.5;
    }
  }

  /**
   * Get cached patterns
   */
  getPatterns(symbol: string): IntradayPattern[] {
    return this.patternCache.get(symbol) || [];
  }

  /**
   * Clear opening ranges (call at market open)
   */
  clearOpeningRanges(): void {
    this.openingRanges.clear();
  }
}