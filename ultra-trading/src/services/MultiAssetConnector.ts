/**
 * Multi-Asset Market Connector
 * Unified interface for crypto, forex, and commodities trading
 */

import { CloudflareBindings } from '@/types';
import { AlpacaClient } from './alpaca/AlpacaClient';
import { createLogger } from '@/utils';
import { OrderSide, OrderType, TimeInForce } from '@/types/trading';

export enum AssetClass {
  STOCKS = 'STOCKS',
  CRYPTO = 'CRYPTO',
  FOREX = 'FOREX',
  COMMODITIES = 'COMMODITIES',
  OPTIONS = 'OPTIONS'
}

export interface AssetQuote {
  symbol: string;
  assetClass: AssetClass;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
  exchange?: string;
}

export interface AssetBar {
  symbol: string;
  assetClass: AssetClass;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  vwap?: number;
}

export interface OrderMetadata {
  strategy?: string;
  entryReason?: string;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  signalId?: string;
  agentId?: string;
}

export interface AssetOrder {
  symbol: string;
  assetClass: AssetClass;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit' | 'stop';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  metadata?: OrderMetadata;
}

export interface OrderResult {
  id: string;
  symbol: string;
  status: 'pending' | 'accepted' | 'filled' | 'rejected' | 'cancelled';
  filledQty?: number;
  filledPrice?: number;
  createdAt: Date;
  message?: string;
}

interface Connector {
  getQuote(symbol: string): Promise<AssetQuote>;
  getBars(symbol: string, timeframe: string, limit: number): Promise<AssetBar[]>;
  submitOrder(order: AssetOrder): Promise<OrderResult>;
  isAvailable(): boolean;
  getTradingHours(): { start: string; end: string; timezone: string };
}

/**
 * Alpaca Crypto Connector
 */
class AlpacaCryptoConnector implements Connector {
  constructor(
    private alpacaClient: AlpacaClient,
    private logger: ReturnType<typeof createLogger>
  ) {}

  async getQuote(symbol: string): Promise<AssetQuote> {
    try {
      interface CryptoQuoteResponse {
        quote: {
          bp: number;  // bid price
          ap: number;  // ask price
          s?: number;  // size
          t: string;   // timestamp
          x: string;   // exchange
        };
      }
      const quote = await this.alpacaClient.dataRequest(`/v1beta3/crypto/${symbol}/quotes/latest`) as CryptoQuoteResponse;
      const q = quote.quote;
      
      return {
        symbol,
        assetClass: AssetClass.CRYPTO,
        bid: q.bp,
        ask: q.ap,
        last: (q.bp + q.ap) / 2,
        volume: q.s || 0,
        timestamp: new Date(q.t),
        exchange: q.x
      };
    } catch (error) {
      this.logger.error('Failed to get crypto quote', { symbol, error });
      throw error;
    }
  }

  async getBars(symbol: string, _timeframe: string, _limit: number): Promise<AssetBar[]> {
    try {
      interface CryptoBarsResponse {
        bars: Array<{
          o: number;   // open
          h: number;   // high
          l: number;   // low
          c: number;   // close
          v: number;   // volume
          t: string;   // timestamp
          vw?: number; // vwap
        }>;
      }
      const response = await this.alpacaClient.dataRequest(`/v1beta3/crypto/${symbol}/bars`, {
        queryParams: {
          timeframe: _timeframe,
          limit: _limit,
          asof: new Date().toISOString()
        }
      }) as CryptoBarsResponse;
      
      const bars = response.bars || [];
      return bars.map((bar) => ({
        symbol,
        assetClass: AssetClass.CRYPTO,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        timestamp: new Date(bar.t),
        vwap: bar.vw
      }));
    } catch (error) {
      this.logger.error('Failed to get crypto bars', { symbol, error });
      throw error;
    }
  }

  async submitOrder(order: AssetOrder): Promise<OrderResult> {
    const alpacaOrder = await this.alpacaClient.submitOrder({
      symbol: order.symbol,
      qty: order.quantity,
      side: order.side === 'buy' ? OrderSide.BUY : OrderSide.SELL,
      type: mapOrderTypeStatic(order.type),
      time_in_force: mapTimeInForceStatic(order.timeInForce),
      limit_price: order.limitPrice,
      stop_price: order.stopPrice,
      extended_hours: true // Crypto trades 24/7
    });
    
    return {
      id: alpacaOrder.id,
      symbol: alpacaOrder.symbol,
      status: alpacaOrder.status as OrderResult['status'],
      filledQty: alpacaOrder.filledQuantity,
      filledPrice: alpacaOrder.filledAvgPrice,
      createdAt: alpacaOrder.createdAt,
      message: alpacaOrder.rejected_reason
    };
  }

  isAvailable(): boolean {
    return true; // Crypto trades 24/7
  }

  getTradingHours() {
    return {
      start: '00:00',
      end: '23:59',
      timezone: 'UTC'
    };
  }
}

/**
 * Forex Connector (Stub for future implementation)
 */
class ForexConnector implements Connector {
  constructor(private logger: ReturnType<typeof createLogger>) {}

  async getQuote(symbol: string): Promise<AssetQuote> {
    // Stub implementation - would connect to OANDA/IB
    this.logger.warn('Forex connector not implemented', { symbol });
    throw new Error('Forex trading not yet implemented');
  }

  async getBars(symbol: string, _timeframe: string, _limit: number): Promise<AssetBar[]> {
    this.logger.warn('Forex connector not implemented', { symbol });
    throw new Error('Forex trading not yet implemented');
  }

  async submitOrder(order: AssetOrder): Promise<OrderResult> {
    this.logger.warn('Forex connector not implemented', { order });
    throw new Error('Forex trading not yet implemented');
  }

  isAvailable(): boolean {
    return false;
  }

  getTradingHours() {
    return {
      start: '17:00', // Sunday 5PM ET
      end: '17:00', // Friday 5PM ET
      timezone: 'America/New_York'
    };
  }
}

/**
 * Commodities Connector (Stub for future implementation)
 */
class CommoditiesConnector implements Connector {
  constructor(private logger: ReturnType<typeof createLogger>) {}

  async getQuote(symbol: string): Promise<AssetQuote> {
    // Stub implementation - would connect to futures data feed
    this.logger.warn('Commodities connector not implemented', { symbol });
    throw new Error('Commodities trading not yet implemented');
  }

  async getBars(symbol: string, _timeframe: string, _limit: number): Promise<AssetBar[]> {
    this.logger.warn('Commodities connector not implemented', { symbol });
    throw new Error('Commodities trading not yet implemented');
  }

  async submitOrder(order: AssetOrder): Promise<OrderResult> {
    this.logger.warn('Commodities connector not implemented', { order });
    throw new Error('Commodities trading not yet implemented');
  }

  isAvailable(): boolean {
    return false;
  }

  getTradingHours() {
    return {
      start: '18:00', // Sunday 6PM ET
      end: '17:00', // Friday 5PM ET
      timezone: 'America/New_York'
    };
  }
}

/**
 * Multi-Asset Connector
 * Unified interface for all asset classes
 */
export class MultiAssetConnector {
  private connectors: Map<AssetClass, Connector>;
  private logger: ReturnType<typeof createLogger>;
  private alpacaClient: AlpacaClient;

  constructor(env: CloudflareBindings, requestId: string) {
    this.logger = createLogger({ env, requestId } as any);
    this.alpacaClient = new AlpacaClient(env, requestId);
    
    // Initialize connectors
    this.connectors = new Map<AssetClass, Connector>();
    this.connectors.set(AssetClass.CRYPTO, new AlpacaCryptoConnector(this.alpacaClient, this.logger));
    this.connectors.set(AssetClass.FOREX, new ForexConnector(this.logger));
    this.connectors.set(AssetClass.COMMODITIES, new CommoditiesConnector(this.logger));
  }

  /**
   * Get asset class from symbol
   */
  private getAssetClass(symbol: string): AssetClass {
    // Crypto symbols
    if (symbol.includes('-USD') || symbol.includes('/USD')) {
      return AssetClass.CRYPTO;
    }
    
    // Forex pairs
    if (symbol.match(/^[A-Z]{3}\/[A-Z]{3}$/)) {
      return AssetClass.FOREX;
    }
    
    // Commodities (futures)
    if (symbol.match(/^[A-Z]{2,3}[0-9]{2}$/)) {
      return AssetClass.COMMODITIES;
    }
    
    // Options
    if (symbol.length > 10 && symbol.match(/[0-9]{6}[CP][0-9]{8}/)) {
      return AssetClass.OPTIONS;
    }
    
    // Default to stocks
    return AssetClass.STOCKS;
  }

  /**
   * Get quote for any asset
   */
  async getQuote(symbol: string): Promise<AssetQuote> {
    const assetClass = this.getAssetClass(symbol);
    
    // Use Alpaca for stocks
    if (assetClass === AssetClass.STOCKS) {
      const quote = await this.alpacaClient.marketData.getLatestQuote(symbol);
      return {
        symbol,
        assetClass,
        bid: quote.bid_price,
        ask: quote.ask_price,
        last: (quote.bid_price + quote.ask_price) / 2,
        volume: 0, // Volume not in quote
        timestamp: new Date(quote.timestamp)
      };
    }
    
    const connector = this.connectors.get(assetClass);
    if (!connector) {
      throw new Error(`No connector for asset class: ${assetClass}`);
    }
    
    return connector.getQuote(symbol);
  }

  /**
   * Get bars for any asset
   */
  async getBars(
    symbol: string, 
    timeframe: string = '5Min',
    limit: number = 100
  ): Promise<AssetBar[]> {
    const assetClass = this.getAssetClass(symbol);
    
    // Use Alpaca for stocks
    if (assetClass === AssetClass.STOCKS) {
      const response = await this.alpacaClient.marketData.getBars(symbol, {
        timeframe,
        limit
      });
      
      return response.bars.map(bar => ({
        symbol,
        assetClass,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        timestamp: new Date(bar.t)
      }));
    }
    
    const connector = this.connectors.get(assetClass);
    if (!connector) {
      throw new Error(`No connector for asset class: ${assetClass}`);
    }
    
    return connector.getBars(symbol, timeframe, limit);
  }

  /**
   * Submit order for any asset
   */
  async submitOrder(order: AssetOrder): Promise<OrderResult> {
    const assetClass = order.assetClass || this.getAssetClass(order.symbol);
    
    // Use Alpaca for stocks
    if (assetClass === AssetClass.STOCKS || assetClass === AssetClass.OPTIONS) {
      const alpacaOrder = await this.alpacaClient.submitOrder({
        symbol: order.symbol,
        qty: order.quantity,
        side: order.side === 'buy' ? OrderSide.BUY : OrderSide.SELL,
        type: this.mapOrderType(order.type),
        time_in_force: this.mapTimeInForce(order.timeInForce),
        limit_price: order.limitPrice,
        stop_price: order.stopPrice
      });
      
      return {
        id: alpacaOrder.id,
        symbol: alpacaOrder.symbol,
        status: alpacaOrder.status as OrderResult['status'],
        filledQty: alpacaOrder.filledQuantity,
        filledPrice: alpacaOrder.filledAvgPrice,
        createdAt: alpacaOrder.createdAt,
        message: alpacaOrder.rejected_reason
      };
    }
    
    const connector = this.connectors.get(assetClass);
    if (!connector) {
      throw new Error(`No connector for asset class: ${assetClass}`);
    }
    
    return connector.submitOrder(order);
  }

  /**
   * Check if asset is tradable now
   */
  async isTradable(symbol: string): Promise<boolean> {
    const assetClass = this.getAssetClass(symbol);
    
    // Check stock market hours
    if (assetClass === AssetClass.STOCKS || assetClass === AssetClass.OPTIONS) {
      const clock = await this.alpacaClient.getClock();
      return clock.isOpen;
    }
    
    const connector = this.connectors.get(assetClass);
    return connector?.isAvailable() || false;
  }

  /**
   * Get trading hours for asset class
   */
  getTradingHours(assetClass: AssetClass): { start: string; end: string; timezone: string } {
    if (assetClass === AssetClass.STOCKS || assetClass === AssetClass.OPTIONS) {
      return {
        start: '09:30',
        end: '16:00',
        timezone: 'America/New_York'
      };
    }
    
    const connector = this.connectors.get(assetClass);
    return connector?.getTradingHours() || {
      start: '00:00',
      end: '00:00',
      timezone: 'UTC'
    };
  }

  /**
   * Get available asset classes
   */
  getAvailableAssetClasses(): AssetClass[] {
    const available = [AssetClass.STOCKS, AssetClass.OPTIONS];
    
    for (const [assetClass, connector] of this.connectors) {
      if (connector.isAvailable()) {
        available.push(assetClass);
      }
    }
    
    return available;
  }

  /**
   * Cross-asset arbitrage detection
   */
  async detectArbitrage(
    symbols: string[],
    threshold: number = 0.001 // 0.1% minimum
  ): Promise<Array<{
    symbol1: string;
    symbol2: string;
    spread: number;
    opportunity: 'BUY_1_SELL_2' | 'BUY_2_SELL_1';
  }>> {
    const opportunities: Array<{
      symbol1: string;
      symbol2: string;
      spread: number;
      opportunity: 'BUY_1_SELL_2' | 'BUY_2_SELL_1';
    }> = [];
    
    // Get quotes for all symbols
    const quotes = await Promise.all(
      symbols.map(symbol => this.getQuote(symbol).catch(() => null))
    );
    
    // Compare all pairs
    for (let i = 0; i < quotes.length; i++) {
      for (let j = i + 1; j < quotes.length; j++) {
        const q1 = quotes[i];
        const q2 = quotes[j];
        
        if (!q1 || !q2) continue;
        
        // Simple arbitrage: if same underlying asset on different exchanges
        const spread1 = (q2.bid - q1.ask) / q1.ask;
        const spread2 = (q1.bid - q2.ask) / q2.ask;
        
        if (spread1 > threshold) {
          opportunities.push({
            symbol1: q1.symbol,
            symbol2: q2.symbol,
            spread: spread1,
            opportunity: 'BUY_1_SELL_2'
          });
        }
        
        if (spread2 > threshold) {
          opportunities.push({
            symbol1: q1.symbol,
            symbol2: q2.symbol,
            spread: spread2,
            opportunity: 'BUY_2_SELL_1'
          });
        }
      }
    }
    
    return opportunities;
  }
  
  private mapOrderType(type: string): OrderType {
    return mapOrderTypeStatic(type);
  }
  
  private mapTimeInForce(tif: string): TimeInForce {
    return mapTimeInForceStatic(tif);
  }
}

// Static helper functions
function mapOrderTypeStatic(type: string): OrderType {
  switch (type) {
    case 'market': return OrderType.MARKET;
    case 'limit': return OrderType.LIMIT;
    case 'stop': return OrderType.STOP;
    default: return OrderType.MARKET;
  }
}

function mapTimeInForceStatic(tif: string): TimeInForce {
  switch (tif) {
    case 'day': return TimeInForce.DAY;
    case 'gtc': return TimeInForce.GTC;
    case 'ioc': return TimeInForce.IOC;
    case 'fok': return TimeInForce.FOK;
    default: return TimeInForce.DAY;
  }
}