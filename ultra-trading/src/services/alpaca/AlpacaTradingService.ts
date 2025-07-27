/**
 * ULTRA Trading Platform - Alpaca Trading Service
 * Order execution and portfolio management
 */

import type { CloudflareBindings, TradingOrder, OrderType, OrderStatus } from '../../types';
import { AlpacaClient } from './AlpacaClient';
import { AppError } from '../../utils';

/**
 * Alpaca Account Information
 */
export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  sma: string;
  daytrade_count: number;
}

/**
 * Alpaca Position
 */
export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  qty_available: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

/**
 * Alpaca Order
 */
export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  replaced_at?: string;
  replaced_by?: string;
  replaces?: string;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional?: string;
  qty?: string;
  filled_qty: string;
  filled_avg_price?: string;
  order_class: string;
  order_type: string;
  type: string;
  side: 'buy' | 'sell';
  time_in_force: string;
  limit_price?: string;
  stop_price?: string;
  status: string;
  extended_hours: boolean;
  legs?: AlpacaOrder[];
  trail_percent?: string;
  trail_price?: string;
  hwm?: string;
}

/**
 * Order Request
 */
export interface OrderRequest {
  symbol: string;
  qty?: number;
  notional?: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
  extended_hours?: boolean;
  client_order_id?: string;
  order_class?: 'simple' | 'bracket' | 'oco' | 'oto';
  take_profit?: {
    limit_price: number;
  };
  stop_loss?: {
    stop_price: number;
    limit_price?: number;
  };
}

/**
 * Portfolio Summary
 */
export interface PortfolioSummary {
  totalValue: number;
  cash: number;
  buyingPower: number;
  positions: number;
  dailyPnL: number;
  totalPnL: number;
  longValue: number;
  shortValue: number;
}

/**
 * Alpaca Trading Service
 */
export class AlpacaTradingService {
  private client: AlpacaClient;
  private readonly logger;

  constructor(
    env: CloudflareBindings,
    private readonly requestId: string
  ) {
    this.client = new AlpacaClient(env, requestId);
    
    // Create logger
    this.logger = {
      debug: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'debug', message, requestId: this.requestId, ...meta })),
      info: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'info', message, requestId: this.requestId, ...meta })),
      warn: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'warn', message, requestId: this.requestId, ...meta })),
      error: (message: string, meta?: Record<string, unknown>) => 
        console.log(JSON.stringify({ level: 'error', message, requestId: this.requestId, ...meta }))
    };
  }

  /**
   * Get account information
   */
  async getAccount(): Promise<AlpacaAccount> {
    this.logger.info('Fetching account information');
    
    const account = await this.client.tradingRequest<AlpacaAccount>('/v2/account');
    
    this.logger.info('Account information retrieved', {
      accountId: account.id,
      status: account.status,
      equity: account.equity
    });
    
    return account;
  }

  /**
   * Get all positions
   */
  async getPositions(): Promise<AlpacaPosition[]> {
    this.logger.info('Fetching positions');
    
    const positions = await this.client.tradingRequest<AlpacaPosition[]>('/v2/positions');
    
    this.logger.info('Positions retrieved', {
      count: positions.length
    });
    
    return positions;
  }

  /**
   * Get position for a specific symbol
   */
  async getPosition(symbol: string): Promise<AlpacaPosition | null> {
    try {
      const position = await this.client.tradingRequest<AlpacaPosition>(`/v2/positions/${symbol}`);
      return position;
    } catch (error) {
      if ((error as AppError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string, qty?: number): Promise<AlpacaOrder> {
    this.logger.info('Closing position', { symbol, qty });
    
    const options: any = {};
    if (qty !== undefined) {
      options.queryParams = { qty };
    }
    
    const order = await this.client.tradingRequest<AlpacaOrder>(
      `/v2/positions/${symbol}`,
      {
        method: 'DELETE',
        ...options
      }
    );
    
    this.logger.info('Position close order submitted', {
      symbol,
      orderId: order.id
    });
    
    return order;
  }

  /**
   * Close all positions
   */
  async closeAllPositions(cancelOrders = true): Promise<AlpacaOrder[]> {
    this.logger.warn('Closing all positions', { cancelOrders });
    
    const orders = await this.client.tradingRequest<AlpacaOrder[]>(
      '/v2/positions',
      {
        method: 'DELETE',
        queryParams: { cancel_orders: cancelOrders }
      }
    );
    
    this.logger.info('All positions closed', {
      orderCount: orders.length
    });
    
    return orders;
  }

  /**
   * Submit an order
   */
  async submitOrder(request: OrderRequest): Promise<AlpacaOrder> {
    this.logger.info('Submitting order', {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      qty: request.qty,
      notional: request.notional
    });

    // Validate order request
    if (!request.qty && !request.notional) {
      throw new AppError(
        'INVALID_ORDER',
        'Either qty or notional must be specified',
        400
      );
    }

    if (request.qty && request.notional) {
      throw new AppError(
        'INVALID_ORDER',
        'Cannot specify both qty and notional',
        400
      );
    }

    const order = await this.client.tradingRequest<AlpacaOrder>(
      '/v2/orders',
      {
        method: 'POST',
        body: request as any
      }
    );

    this.logger.info('Order submitted successfully', {
      orderId: order.id,
      clientOrderId: order.client_order_id,
      status: order.status
    });

    return order;
  }

  /**
   * Get all orders
   */
  async getOrders(
    status?: 'open' | 'closed' | 'all',
    limit = 50,
    after?: string,
    until?: string,
    direction?: 'asc' | 'desc',
    nested = false,
    symbols?: string
  ): Promise<AlpacaOrder[]> {
    const queryParams: any = {
      status: status || 'open',
      limit,
      direction: direction || 'desc',
      nested
    };

    if (after) queryParams.after = after;
    if (until) queryParams.until = until;
    if (symbols) queryParams.symbols = symbols;

    const orders = await this.client.tradingRequest<AlpacaOrder[]>(
      '/v2/orders',
      { queryParams }
    );

    return orders;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, nested = false): Promise<AlpacaOrder | null> {
    try {
      const order = await this.client.tradingRequest<AlpacaOrder>(
        `/v2/orders/${orderId}`,
        { queryParams: { nested } }
      );
      return order;
    } catch (error) {
      if ((error as AppError).code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    this.logger.info('Cancelling order', { orderId });
    
    await this.client.tradingRequest(
      `/orders/${orderId}`,
      { method: 'DELETE' }
    );
    
    this.logger.info('Order cancelled', { orderId });
  }

  /**
   * Cancel all orders
   */
  async cancelAllOrders(): Promise<AlpacaOrder[]> {
    this.logger.warn('Cancelling all orders');
    
    const cancelled = await this.client.tradingRequest<AlpacaOrder[]>(
      '/v2/orders',
      { method: 'DELETE' }
    );
    
    this.logger.info('All orders cancelled', {
      count: cancelled.length
    });
    
    return cancelled;
  }

  /**
   * Replace an order
   */
  async replaceOrder(
    orderId: string,
    request: Partial<OrderRequest>
  ): Promise<AlpacaOrder> {
    this.logger.info('Replacing order', {
      orderId,
      updates: request
    });

    const order = await this.client.tradingRequest<AlpacaOrder>(
      `/orders/${orderId}`,
      {
        method: 'PATCH',
        body: request as any
      }
    );

    this.logger.info('Order replaced', {
      orderId: order.id,
      newOrderId: order.replaced_by
    });

    return order;
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const [account, positions] = await Promise.all([
      this.getAccount(),
      this.getPositions()
    ]);

    const totalValue = parseFloat(account.portfolio_value);
    const cash = parseFloat(account.cash);
    const buyingPower = parseFloat(account.buying_power);
    const longValue = parseFloat(account.long_market_value);
    const shortValue = parseFloat(account.short_market_value);
    const lastEquity = parseFloat(account.last_equity);
    const equity = parseFloat(account.equity);
    const dailyPnL = equity - lastEquity;

    // Calculate total P&L from positions
    const totalPnL = positions.reduce((sum, position) => sum + parseFloat(position.unrealized_pl), 0);

    return {
      totalValue,
      cash,
      buyingPower,
      positions: positions.length,
      dailyPnL,
      totalPnL,
      longValue,
      shortValue
    };
  }

  /**
   * Convert internal order to Alpaca format
   */
  convertToAlpacaOrder(order: Partial<TradingOrder>): OrderRequest {
    if (!order.symbol || !order.side || !order.order_type) {
      throw new AppError('VALIDATION_ERROR', 'Missing required order fields');
    }
    
    const alpacaOrder: OrderRequest = {
      symbol: order.symbol,
      side: order.side,
      type: this.mapOrderType(order.order_type),
      time_in_force: 'day',
      ...(order.quantity !== undefined && { qty: order.quantity })
    };

    if (order.price !== undefined && (order.order_type === 'limit' || order.order_type === 'stop_limit')) {
      alpacaOrder.limit_price = order.price;
    }

    if ((order.order_type === 'stop' || order.order_type === 'stop_limit') && order.price !== undefined) {
      alpacaOrder.stop_price = order.price;
    }

    return alpacaOrder;
  }

  /**
   * Map internal order type to Alpaca format
   */
  private mapOrderType(type: OrderType): 'market' | 'limit' | 'stop' | 'stop_limit' {
    const mapping: Record<OrderType, 'market' | 'limit' | 'stop' | 'stop_limit'> = {
      market: 'market',
      limit: 'limit',
      stop: 'stop',
      stop_limit: 'stop_limit'
    };
    return mapping[type];
  }

  /**
   * Map Alpaca order status to internal format
   */
  mapOrderStatus(alpacaStatus: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      new: 'pending',
      partially_filled: 'partially_filled',
      filled: 'filled',
      done_for_day: 'cancelled',
      canceled: 'cancelled',
      expired: 'cancelled',
      replaced: 'cancelled',
      pending_cancel: 'pending',
      pending_replace: 'pending',
      accepted: 'pending',
      pending_new: 'pending',
      accepted_for_bidding: 'pending',
      stopped: 'cancelled',
      rejected: 'rejected',
      suspended: 'pending',
      calculated: 'pending'
    };

    return mapping[alpacaStatus] || 'pending';
  }

  /**
   * Check if market is open
   */
  async isMarketOpen(): Promise<boolean> {
    const clock = await this.client.tradingRequest<{
      timestamp: string;
      is_open: boolean;
      next_open: string;
      next_close: string;
    }>('/v2/clock');

    return clock.is_open;
  }

  /**
   * Get market calendar
   */
  async getMarketCalendar(start: string, end: string): Promise<any[]> {
    const calendar = await this.client.tradingRequest<any[]>(
      '/v2/calendar',
      {
        queryParams: { start, end }
      }
    );

    return calendar;
  }
}