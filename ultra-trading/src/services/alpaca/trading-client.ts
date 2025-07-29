/**
 * Alpaca Trading Service
 * Multi-tenant wrapper for Alpaca Trading API with encryption
 */

import type { 
  Order, 
  Position, 
  Account
} from '@/types/trading';
import {
  AssetClass,
  OrderSide,
  OrderType,
  TimeInForce
} from '@/types/trading';
import type { OptionContract, OptionChainRequest } from '@/types/options';
import { CredentialManager } from '@/services/security/credential-manager';
import { RateLimiter } from '@/utils/rate-limiter';
import { withRetry } from '@/utils/retry';

export interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
  paper?: boolean;
}

export interface SubmitOrderRequest {
  symbol: string;
  quantity: number;
  side: OrderSide;
  orderType: OrderType;
  timeInForce: TimeInForce;
  limitPrice?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface AlpacaConfig {
  baseUrl?: string;
  apiVersion?: string;
  maxRetries?: number;
  rateLimitPerMinute?: number;
}

/**
 * Alpaca Trading Service
 * Handles all trading operations with multi-tenant support
 */
export class AlpacaService {
  private readonly config: AlpacaConfig;
  private readonly credentialManager: CredentialManager;
  private readonly rateLimiter: RateLimiter;
  private credentials = new Map<string, AlpacaCredentials>();

  constructor(
    credentialManager: CredentialManager,
    config: AlpacaConfig = {}
  ) {
    this.credentialManager = credentialManager;
    this.config = {
      baseUrl: 'https://api.alpaca.markets',
      apiVersion: 'v2',
      maxRetries: 3,
      rateLimitPerMinute: 200,
      ...config
    };
    
    this.rateLimiter = new RateLimiter({
      maxRequests: this.config.rateLimitPerMinute!,
      windowMs: 60000 // 1 minute
    });
  }

  /**
   * Get decrypted credentials for a tenant
   */
  private async getCredentials(tenantId: string): Promise<AlpacaCredentials> {
    // Check cache first
    if (this.credentials.has(tenantId)) {
      return this.credentials.get(tenantId)!;
    }

    // Decrypt from storage
    const encrypted = await this.credentialManager.getCredentials(tenantId, 'alpaca');
    const decrypted = await this.credentialManager.decrypt(encrypted) as AlpacaCredentials;
    
    // Cache for this session
    this.credentials.set(tenantId, decrypted);
    
    return decrypted;
  }

  /**
   * Make authenticated request to Alpaca API
   */
  private async request<T>(
    tenantId: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Rate limiting
    await this.rateLimiter.checkLimit(tenantId);

    // Get credentials
    const creds = await this.getCredentials(tenantId);
    
    // Build URL
    const url = `${this.config.baseUrl}/${this.config.apiVersion}${path}`;
    
    // Add authentication headers
    const headers = {
      'APCA-API-KEY-ID': creds.apiKey,
      'APCA-API-SECRET-KEY': creds.secretKey,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Make request with retry
    return withRetry(async () => {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AlpacaAPIError(response.status, error);
      }

      return response.json();
    }, {
      maxRetries: this.config.maxRetries!,
      retryDelay: 1000
    });
  }

  /**
   * Get account information
   */
  async getAccount(tenantId: string): Promise<Account> {
    const data = await this.request<any>(tenantId, '/account');
    
    return {
      id: data.id,
      accountNumber: data.account_number,
      buyingPower: parseFloat(data.buying_power),
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      patternDayTrader: data.pattern_day_trader,
      tradingBlocked: data.trading_blocked,
      transfersBlocked: data.transfers_blocked,
      accountBlocked: data.account_blocked,
      optionsApproved: data.options_approved_level > 0,
      optionsLevel: data.options_approved_level,
      marketOpen: true, // TODO: Get from clock endpoint
      createdAt: new Date(data.created_at),
      currency: data.currency
    };
  }

  /**
   * Submit a new order
   */
  async submitOrder(
    tenantId: string,
    request: SubmitOrderRequest
  ): Promise<Order> {
    // Validate order
    this.validateOrder(request);

    const body = {
      symbol: request.symbol,
      qty: request.quantity,
      side: request.side,
      type: request.orderType,
      time_in_force: request.timeInForce,
      limit_price: request.limitPrice,
      stop_price: request.stopPrice,
      client_order_id: request.clientOrderId
    };

    const data = await this.request<any>(tenantId, '/orders', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return this.mapOrder(data);
  }

  /**
   * Get all positions
   */
  async getAllPositions(tenantId: string): Promise<Position[]> {
    const data = await this.request<any[]>(tenantId, '/positions');
    return data.map(pos => this.mapPosition(pos));
  }

  /**
   * Get specific position
   */
  async getPosition(tenantId: string, symbol: string): Promise<Position | null> {
    try {
      const data = await this.request<any>(tenantId, `/positions/${symbol}`);
      return this.mapPosition(data);
    } catch (error) {
      if (error instanceof AlpacaAPIError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Close a position
   */
  async closePosition(tenantId: string, symbol: string): Promise<Order> {
    const data = await this.request<any>(tenantId, `/positions/${symbol}`, {
      method: 'DELETE'
    });
    return this.mapOrder(data);
  }

  /**
   * Close all positions
   */
  async closeAllPositions(tenantId: string): Promise<Order[]> {
    const data = await this.request<any[]>(tenantId, '/positions', {
      method: 'DELETE'
    });
    return data.map(order => this.mapOrder(order));
  }

  /**
   * Get option contracts
   */
  async getOptionContracts(
    tenantId: string,
    request: OptionChainRequest
  ): Promise<OptionContract[]> {
    const params = new URLSearchParams({
      underlying_symbols: request.underlyingSymbol || request.underlyingSymbols || '',
      status: 'active',
      type: request.optionType || '',
      strike_price_gte: request.minStrike?.toString() || '',
      strike_price_lte: request.maxStrike?.toString() || '',
      expiration_date_gte: this.formatDate(request.minExpiration),
      expiration_date_lte: this.formatDate(request.maxExpiration),
      limit: (request.limit || 100).toString()
    });

    // Remove empty params
    Array.from(params.keys()).forEach(key => {
      if (!params.get(key)) params.delete(key);
    });

    const data = await this.request<any>(
      tenantId, 
      `/options/contracts?${params.toString()}`
    );

    return data.option_contracts.map((contract: any) => this.mapOptionContract(contract));
  }

  /**
   * Get specific option contract
   */
  async getOptionContract(
    tenantId: string,
    symbol: string
  ): Promise<OptionContract> {
    const data = await this.request<any>(
      tenantId,
      `/options/contracts/${symbol}`
    );
    return this.mapOptionContract(data);
  }

  /**
   * Validate order before submission
   */
  private validateOrder(order: SubmitOrderRequest): void {
    if (!order.symbol) {
      throw new Error('Symbol is required');
    }

    if (order.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (!['buy', 'sell'].includes(order.side)) {
      throw new Error('Invalid order side');
    }

    if (order.orderType === 'limit' && !order.limitPrice) {
      throw new Error('Limit price required for limit orders');
    }

    if (order.orderType === 'stop' && !order.stopPrice) {
      throw new Error('Stop price required for stop orders');
    }
  }

  /**
   * Map Alpaca order to internal format
   */
  private mapOrder(data: any): Order {
    return {
      id: data.id,
      clientOrderId: data.client_order_id,
      symbol: data.symbol,
      assetClass: data.asset_class as AssetClass,
      quantity: parseFloat(data.qty),
      filledQuantity: parseFloat(data.filled_qty || '0'),
      side: data.side as OrderSide,
      orderType: data.order_type as OrderType,
      timeInForce: data.time_in_force as TimeInForce,
      limitPrice: data.limit_price ? parseFloat(data.limit_price) : undefined,
      stopPrice: data.stop_price ? parseFloat(data.stop_price) : undefined,
      filledAvgPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : undefined,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      submittedAt: new Date(data.submitted_at),
      filledAt: data.filled_at ? new Date(data.filled_at) : undefined,
      canceledAt: data.canceled_at ? new Date(data.canceled_at) : undefined
    };
  }

  /**
   * Map Alpaca position to internal format
   */
  private mapPosition(data: any): Position {
    return {
      assetId: data.asset_id,
      symbol: data.symbol,
      exchange: data.exchange,
      assetClass: data.asset_class as AssetClass,
      quantity: parseFloat(data.qty),
      availableQuantity: parseFloat(data.qty_available),
      avgEntryPrice: parseFloat(data.avg_entry_price),
      marketValue: parseFloat(data.market_value),
      costBasis: parseFloat(data.cost_basis),
      unrealizedPL: parseFloat(data.unrealized_pl),
      unrealizedPLPercent: parseFloat(data.unrealized_plpc),
      currentPrice: parseFloat(data.current_price),
      lastPrice: parseFloat(data.lastday_price),
      changeToday: parseFloat(data.change_today)
    };
  }

  /**
   * Map Alpaca option contract to internal format
   */
  private mapOptionContract(data: any): OptionContract {
    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      status: data.status,
      tradable: data.tradable,
      underlyingSymbol: data.underlying_symbol,
      underlyingAssetId: data.underlying_asset_id,
      type: data.type as 'call' | 'put',
      style: data.style,
      strikePrice: parseFloat(data.strike_price),
      expirationDate: data.expiration_date,
      contractSize: parseInt(data.size),
      minTicks: data.min_ticks,
      openInterest: data.open_interest ? parseInt(data.open_interest) : undefined,
      openInterestDate: data.open_interest_date,
      volume: data.close_price_date ? parseInt(data.day_volume) : undefined
    };
  }

  /**
   * Format date for API
   */
  private formatDate(date?: Date | number): string {
    if (!date) return '';
    
    let dateObj: Date;
    if (typeof date === 'number') {
      // Days from now
      dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + date);
    } else {
      dateObj = date;
    }
    
    return dateObj.toISOString().split('T')[0] || '';
  }
}

/**
 * Alpaca API Error
 */
export class AlpacaAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`Alpaca API Error (${status}): ${message}`);
    this.name = 'AlpacaAPIError';
  }
}