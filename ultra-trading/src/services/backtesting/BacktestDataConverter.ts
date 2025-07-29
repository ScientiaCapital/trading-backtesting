/**
 * ULTRA Trading Platform - Backtest Data Converter
 * Converts between Alpaca and fastquant data formats
 */

import type { AlpacaBar } from '../alpaca/AlpacaMarketData';
import type { OHLCVData, DataConverter } from '../../types/backtesting';

export class BacktestDataConverter implements DataConverter {
  /**
   * Convert Alpaca bars to OHLCV format for fastquant
   */
  alpacaBarsToOHLCV(bars: AlpacaBar[]): OHLCVData {
    // Sort bars by timestamp to ensure chronological order
    const sortedBars = [...bars].sort((a, b) => 
      new Date(a.t).getTime() - new Date(b.t).getTime()
    );

    const ohlcv: OHLCVData = {
      date: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: []
    };

    for (const bar of sortedBars) {
      // Convert timestamp to YYYY-MM-DD format for fastquant
      if (!bar.t) continue;
      const date = new Date(bar.t);
      const dateStr = date.toISOString().split('T')[0];
      
      ohlcv.date.push(dateStr);
      ohlcv.open.push(bar.o || 0);
      ohlcv.high.push(bar.h || 0);
      ohlcv.low.push(bar.l || 0);
      ohlcv.close.push(bar.c || 0);
      ohlcv.volume.push(bar.v || 0);
    }

    return ohlcv;
  }

  /**
   * Convert OHLCV data to DataFrame-like structure for Python
   */
  ohlcvToDataFrame(data: OHLCVData): any {
    // Create a structure that can be easily converted to pandas DataFrame
    const rows = [];
    
    for (let i = 0; i < data.date.length; i++) {
      rows.push({
        date: data.date[i],
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i],
        volume: data.volume[i]
      });
    }

    return {
      columns: ['date', 'open', 'high', 'low', 'close', 'volume'],
      data: rows,
      index: data.date
    };
  }

  /**
   * Convert intraday bars with timestamps
   */
  convertIntradayBars(bars: AlpacaBar[]): OHLCVData {
    const sortedBars = [...bars].sort((a, b) => 
      new Date(a.t).getTime() - new Date(b.t).getTime()
    );

    const ohlcv: OHLCVData = {
      date: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: []
    };

    for (const bar of sortedBars) {
      // Keep full timestamp for intraday data
      ohlcv.date.push(bar.t || '');
      ohlcv.open.push(bar.o || 0);
      ohlcv.high.push(bar.h || 0);
      ohlcv.low.push(bar.l || 0);
      ohlcv.close.push(bar.c || 0);
      ohlcv.volume.push(bar.v || 0);
    }

    return ohlcv;
  }

  /**
   * Validate data quality before backtesting
   */
  validateData(data: OHLCVData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if all arrays have the same length
    const lengths = [
      data.date.length,
      data.open.length,
      data.high.length,
      data.low.length,
      data.close.length,
      data.volume.length
    ];

    if (!lengths.every(len => len === lengths[0])) {
      errors.push('Data arrays have different lengths');
    }

    // Check for empty data
    if (data.date.length === 0) {
      errors.push('No data points available');
    }

    // Check for invalid values
    for (let i = 0; i < data.date.length; i++) {
      const high = data.high[i];
      const low = data.low[i];
      const open = data.open[i];
      const close = data.close[i];
      const volume = data.volume[i];
      const date = data.date[i];
      
      if (high !== undefined && low !== undefined && high < low) {
        errors.push(`Invalid OHLC at ${date}: high < low`);
      }
      
      if ((open !== undefined && open <= 0) || (close !== undefined && close <= 0)) {
        errors.push(`Invalid price at ${date}: price <= 0`);
      }

      if (volume !== undefined && volume < 0) {
        errors.push(`Invalid volume at ${date}: volume < 0`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Fill missing data points (for daily data)
   */
  fillMissingData(data: OHLCVData): OHLCVData {
    if (data.date.length === 0) return data;

    const filled: OHLCVData = {
      date: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: []
    };

    // Create a map of existing data
    const dataMap = new Map<string, number>();
    for (let i = 0; i < data.date.length; i++) {
      const dateKey = data.date[i];
      if (dateKey !== undefined) {
        dataMap.set(dateKey, i);
      }
    }

    // Generate all trading days
    const firstDate = data.date[0];
    const lastDate = data.date[data.date.length - 1];
    if (!firstDate || !lastDate) return data;
    
    const startDate = new Date(firstDate);
    const endDate = new Date(lastDate);
    const currentDate = new Date(startDate);

    let lastValidIndex = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        if (dateStr && dataMap.has(dateStr)) {
          // Use existing data
          const idx = dataMap.get(dateStr)!;
          filled.date.push(dateStr);
          filled.open.push(data.open[idx] ?? 0);
          filled.high.push(data.high[idx] ?? 0);
          filled.low.push(data.low[idx] ?? 0);
          filled.close.push(data.close[idx] ?? 0);
          filled.volume.push(data.volume[idx] ?? 0);
          lastValidIndex = idx;
        } else {
          // Forward fill missing data
          const lastClose = data.close[lastValidIndex] || 0;
          filled.date.push(dateStr);
          filled.open.push(lastClose); // Open = previous close
          filled.high.push(lastClose);
          filled.low.push(lastClose);
          filled.close.push(lastClose);
          filled.volume.push(0); // No volume on missing days
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return filled;
  }

  /**
   * Resample data to different timeframe
   */
  resampleData(data: OHLCVData, fromTimeframe: string, toTimeframe: string): OHLCVData {
    // This is a simplified resampling - in production, use more sophisticated logic
    if (fromTimeframe === '1m' && toTimeframe === '5m') {
      return this.resampleMinuteData(data, 5);
    } else if (fromTimeframe === '1m' && toTimeframe === '15m') {
      return this.resampleMinuteData(data, 15);
    } else if (fromTimeframe === '1m' && toTimeframe === '1h') {
      return this.resampleMinuteData(data, 60);
    }
    
    // Return original if no resampling needed
    return data;
  }

  /**
   * Resample minute data to larger timeframes
   */
  private resampleMinuteData(data: OHLCVData, minutes: number): OHLCVData {
    const resampled: OHLCVData = {
      date: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: []
    };

    for (let i = 0; i < data.date.length; i += minutes) {
      const endIdx = Math.min(i + minutes, data.date.length);
      
      // Get the slice for this period
      const periodOpen = data.open[i] || 0;
      const periodClose = data.close[endIdx - 1] || 0;
      const highSlice = data.high.slice(i, endIdx).filter(h => h !== undefined);
      const lowSlice = data.low.slice(i, endIdx).filter(l => l !== undefined);
      const periodHigh = highSlice.length > 0 ? Math.max(...highSlice) : 0;
      const periodLow = lowSlice.length > 0 ? Math.min(...lowSlice) : 0;
      const periodVolume = data.volume.slice(i, endIdx).reduce((a, b) => (a || 0) + (b || 0), 0);
      
      const dateValue = data.date[i];
      if (dateValue) {
        resampled.date.push(dateValue);
        resampled.open.push(periodOpen);
        resampled.high.push(periodHigh);
        resampled.low.push(periodLow);
        resampled.close.push(periodClose);
        resampled.volume.push(periodVolume);
      }
    }

    return resampled;
  }
}