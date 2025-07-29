/**
 * Technical Indicators Service
 * Provides professional-grade technical analysis indicators using @ixjb94/indicators
 */

import { Indicators } from '@ixjb94/indicators';
import { MarketData } from '@/types/strategy';
import { createLogger } from '@/utils';
import { CloudflareBindings } from '@/types';

export interface MarketDataWithIndicators extends MarketData {
  indicators?: {
    rsi?: number;
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bb?: {
      upper: number;
      middle: number;
      lower: number;
    };
    vwap?: number;
    atr?: number;
    ema?: {
      ema9?: number;
      ema21?: number;
      ema50?: number;
      ema200?: number;
    };
    sma?: {
      sma20?: number;
      sma50?: number;
      sma200?: number;
    };
    adx?: number;
    stochastic?: {
      k: number;
      d: number;
    };
  };
}

export interface IndicatorParams {
  rsiPeriod?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  atrPeriod?: number;
  adxPeriod?: number;
  stochasticKPeriod?: number;
  stochasticDPeriod?: number;
}

export class TechnicalIndicatorsService {
  private indicators: Indicators;
  private logger: ReturnType<typeof createLogger>;

  constructor(env: CloudflareBindings) {
    this.indicators = new Indicators();
    this.logger = createLogger({ env } as any);
  }

  /**
   * Calculate all indicators for market data
   */
  async calculateIndicators(
    marketData: MarketData[],
    params: IndicatorParams = {}
  ): Promise<MarketDataWithIndicators[]> {
    if (marketData.length === 0) return [];

    // Extract price data
    const closes = marketData.map(d => d.close || d.price);
    const highs = marketData.map(d => d.high || d.price);
    const lows = marketData.map(d => d.low || d.price);
    const volumes = marketData.map(d => d.volume || 0);

    // Calculate indicators
    const rsi = await this.calculateRSI(closes, params.rsiPeriod);
    const macd = await this.calculateMACD(closes, params.macdFast, params.macdSlow, params.macdSignal);
    const bb = await this.calculateBollingerBands(closes, params.bbPeriod, params.bbStdDev);
    const vwap = await this.calculateVWAP(closes, highs, lows, volumes);
    const atr = await this.calculateATR(highs, lows, closes, params.atrPeriod);
    const ema = await this.calculateEMAs(closes);
    const sma = await this.calculateSMAs(closes);

    // Merge indicators with market data
    return marketData.map((data, index) => ({
      ...data,
      indicators: {
        rsi: rsi[index],
        macd: macd[index],
        bb: bb[index],
        vwap: vwap[index],
        atr: atr[index],
        ema: ema[index],
        sma: sma[index]
      }
    }));
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  async calculateRSI(closes: number[], period = 14): Promise<(number | undefined)[]> {
    try {
      const rsiValues = await this.indicators.rsi(closes, period);
      return this.padUndefined(rsiValues, closes.length);
    } catch (error) {
      this.logger.error('RSI calculation failed', { error });
      return new Array(closes.length).fill(undefined);
    }
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  async calculateMACD(
    closes: number[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ): Promise<({ macd: number; signal: number; histogram: number } | undefined)[]> {
    try {
      const macdResult = await this.indicators.macd(closes, fastPeriod, slowPeriod, signalPeriod);
      
      // Convert to our format
      const result: ({ macd: number; signal: number; histogram: number } | undefined)[] = [];
      for (let i = 0; i < closes.length; i++) {
        if (i < slowPeriod + signalPeriod - 2) {
          result.push(undefined);
        } else {
          const idx = i - (slowPeriod + signalPeriod - 2);
          if (macdResult[0]?.[idx] !== undefined && 
              macdResult[1]?.[idx] !== undefined &&
              macdResult[2]?.[idx] !== undefined) {
            result.push({
              macd: macdResult[0][idx],      // MACD line
              signal: macdResult[1][idx],    // Signal line
              histogram: macdResult[2][idx]  // Histogram
            });
          } else {
            result.push(undefined);
          }
        }
      }
      return result;
    } catch (error) {
      this.logger.error('MACD calculation failed', { error });
      return new Array(closes.length).fill(undefined);
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  async calculateBollingerBands(
    closes: number[],
    period = 20,
    stdDev = 2
  ): Promise<({ upper: number; middle: number; lower: number } | undefined)[]> {
    try {
      const bbResult = await (this.indicators as any).bbands(closes, period, stdDev, stdDev);
      
      const result: ({ upper: number; middle: number; lower: number } | undefined)[] = [];
      for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
          result.push(undefined);
        } else {
          const idx = i - (period - 1);
          if (bbResult[0]?.[idx] !== undefined) {
            result.push({
              upper: bbResult[0][idx],    // Upper band
              middle: bbResult[1][idx],  // Middle band (SMA)
              lower: bbResult[2][idx]    // Lower band
            });
          } else {
            result.push(undefined);
          }
        }
      }
      return result;
    } catch (error) {
      this.logger.error('Bollinger Bands calculation failed', { error });
      return new Array(closes.length).fill(undefined);
    }
  }

  /**
   * Calculate VWAP (Volume Weighted Average Price)
   */
  async calculateVWAP(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  ): Promise<(number | undefined)[]> {
    try {
      // Calculate typical price and cumulative values
      const vwapValues: (number | undefined)[] = [];
      let cumulativeTPV = 0;
      let cumulativeVolume = 0;

      for (let i = 0; i < closes.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const close = closes[i];
        const volume = volumes[i];
        
        if (high === undefined || low === undefined || close === undefined || volume === undefined) {
          vwapValues.push(undefined);
          continue;
        }
        
        const typicalPrice = (high + low + close) / 3;
        cumulativeTPV += typicalPrice * volume;
        cumulativeVolume += volume;
        
        if (cumulativeVolume > 0) {
          vwapValues.push(cumulativeTPV / cumulativeVolume);
        } else {
          vwapValues.push(closes[i] || 0);
        }
      }

      return vwapValues;
    } catch (error) {
      this.logger.error('VWAP calculation failed', { error });
      return new Array(closes.length).fill(undefined);
    }
  }

  /**
   * Calculate ATR (Average True Range)
   */
  async calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period = 14
  ): Promise<(number | undefined)[]> {
    try {
      const atrValues = await this.indicators.atr(highs, lows, closes, period);
      return this.padUndefined(atrValues, closes.length);
    } catch (error) {
      this.logger.error('ATR calculation failed', { error });
      return new Array(closes.length).fill(undefined);
    }
  }

  /**
   * Calculate multiple EMAs
   */
  async calculateEMAs(closes: number[]): Promise<any[]> {
    try {
      const [ema9, ema21, ema50, ema200] = await Promise.all([
        this.indicators.ema(closes, 9),
        this.indicators.ema(closes, 21),
        this.indicators.ema(closes, 50),
        this.indicators.ema(closes, 200)
      ]);

      return closes.map((_, i) => ({
        ema9: ema9[i],
        ema21: ema21[i],
        ema50: ema50[i],
        ema200: ema200[i]
      }));
    } catch (error) {
      this.logger.error('EMA calculation failed', { error });
      return new Array(closes.length).fill({});
    }
  }

  /**
   * Calculate multiple SMAs
   */
  async calculateSMAs(closes: number[]): Promise<any[]> {
    try {
      const [sma20, sma50, sma200] = await Promise.all([
        this.indicators.sma(closes, 20),
        this.indicators.sma(closes, 50),
        this.indicators.sma(closes, 200)
      ]);

      return closes.map((_, i) => ({
        sma20: sma20[i],
        sma50: sma50[i],
        sma200: sma200[i]
      }));
    } catch (error) {
      this.logger.error('SMA calculation failed', { error });
      return new Array(closes.length).fill({});
    }
  }

  /**
   * Get single indicator value for latest data point
   */
  async getLatestIndicator(
    marketData: MarketData[],
    indicator: 'rsi' | 'macd' | 'bb' | 'vwap' | 'atr',
    params?: IndicatorParams
  ): Promise<any> {
    if (marketData.length === 0) return undefined;

    const closes = marketData.map(d => d.close || d.price);
    
    switch (indicator) {
      case 'rsi':
        const rsi = await this.calculateRSI(closes, params?.rsiPeriod);
        return rsi[rsi.length - 1];
      
      case 'macd':
        const macd = await this.calculateMACD(
          closes,
          params?.macdFast,
          params?.macdSlow,
          params?.macdSignal
        );
        return macd[macd.length - 1];
      
      case 'bb':
        const bb = await this.calculateBollingerBands(
          closes,
          params?.bbPeriod,
          params?.bbStdDev
        );
        return bb[bb.length - 1];
      
      case 'vwap':
        const highs = marketData.map(d => d.high || d.price);
        const lows = marketData.map(d => d.low || d.price);
        const volumes = marketData.map(d => d.volume || 0);
        const vwap = await this.calculateVWAP(closes, highs, lows, volumes);
        return vwap[vwap.length - 1];
      
      case 'atr':
        const highsAtr = marketData.map(d => d.high || d.price);
        const lowsAtr = marketData.map(d => d.low || d.price);
        const atr = await this.calculateATR(highsAtr, lowsAtr, closes, params?.atrPeriod);
        return atr[atr.length - 1];
      
      default:
        return undefined;
    }
  }

  /**
   * Pad array with undefined values to match original length
   */
  private padUndefined(values: number[], targetLength: number): (number | undefined)[] {
    const result: (number | undefined)[] = [];
    const startPad = targetLength - values.length;
    
    for (let i = 0; i < startPad; i++) {
      result.push(undefined);
    }
    
    for (const value of values) {
      result.push(value);
    }
    
    return result;
  }

}