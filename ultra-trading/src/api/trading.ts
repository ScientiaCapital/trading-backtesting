/**
 * Alpaca Trading API Routes
 * Real trading operations with Alpaca Markets
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiContext } from '../types';
import { AlpacaClient } from '../services/alpaca/AlpacaClient';
import { AlpacaTradingService } from '../services/alpaca/AlpacaTradingService';
import { OrderSide, OrderType, TimeInForce } from '../types/trading';
import { 
  validateRequest,
  createApiResponse,
  createErrorResponse,
  createError,
  AppError as _AppError,
  NotFoundError,
  ValidationError,
  createLogger
} from '../utils';
import {
  authMiddleware,
  rateLimitMiddleware,
  requireRole
} from '../middleware';
import { devAuthMiddleware } from '../middleware/dev-auth';

/**
 * Trading Routes
 */
export const tradingRoutes = new Hono<ApiContext>();

/**
 * Public Dashboard Status (No Auth Required)  
 * Returns market status and basic trading info for dashboard
 */
tradingRoutes.get('/dashboard-status', async (c) => {
  const logger = createLogger(c);
  
  try {
    // Get market clock without auth
    const alpaca = new AlpacaClient(c.env, 'dashboard');
    const clock = await alpaca.getClock();
    
    // Get basic account info for dashboard
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();
    
    // Calculate daily P&L
    const dailyPnL = positions.reduce((sum, pos) => sum + parseFloat(String(pos.unrealizedPL || 0)), 0);
    
    const dashboardData = {
      clock: {
        is_open: clock.isOpen,
        next_open: clock.nextOpen,
        next_close: clock.nextClose,
        timestamp: clock.timestamp
      },
      account: {
        buyingPower: account.buyingPower,
        cash: account.cash,
        portfolioValue: account.portfolioValue
      },
      positions: {
        count: positions.length,
        dailyPnL,
        totalValue: positions.reduce((sum, pos) => sum + parseFloat(String(pos.marketValue || 0)), 0)
      },
      trading: {
        enabled: true, // Default enabled for now
        mode: clock.isOpen ? 'TRADING' : 'CLOSED'
      }
    };
    
    logger.info('Dashboard status retrieved', { 
      isOpen: clock.isOpen,
      positionCount: positions.length,
      dailyPnL 
    });
    
    return c.json(createApiResponse(dashboardData));
  } catch (error) {
    logger.error('Failed to get dashboard status', { error: (error as Error).message });
    
    // Return fallback data for dashboard
    return c.json(createApiResponse({
      clock: {
        is_open: false,
        next_open: new Date().toISOString(),
        next_close: new Date().toISOString(),
        timestamp: new Date().toISOString()
      },
      account: {
        buyingPower: '0',
        cash: '0',
        portfolioValue: '0'
      },
      positions: {
        count: 0,
        dailyPnL: 0,
        totalValue: 0
      },
      trading: {
        enabled: false,
        mode: 'ERROR'
      }
    }));
  }
});

// Apply middleware to all other trading routes (not dashboard-status)
// For development, use devAuthMiddleware instead of authMiddleware
tradingRoutes.use('*', async (c, next) => {
  // Skip auth for dashboard-status endpoint
  if (c.req.path.endsWith('/dashboard-status')) {
    await next();
    return;
  }
  
  const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === undefined;
  if (isDev) {
    return devAuthMiddleware(c, next);
  } else {
    return authMiddleware(c, next);
  }
});
// Temporarily disable tenant isolation for testing
// tradingRoutes.use('*', tenantIsolationMiddleware);
tradingRoutes.use('*', rateLimitMiddleware({ windowMs: 60000, maxRequests: 200 })); // Alpaca limit

/**
 * Get Account Information
 */
tradingRoutes.get('/account', async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const account = await alpaca.getAccount();
    
    logger.info('Account info retrieved', { 
      accountId: account.id,
      buyingPower: account.buyingPower 
    });
    
    return c.json(createApiResponse(account));
  } catch (error) {
    logger.error('Failed to get account info', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('ACCOUNT_ERROR', 'Failed to retrieve account information')), 500);
  }
});

/**
 * Get All Positions
 */
tradingRoutes.get('/positions', async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const positions = await alpaca.getPositions();
    
    logger.info('Positions retrieved', { count: positions.length });
    return c.json(createApiResponse(positions));
  } catch (error) {
    logger.error('Failed to get positions', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('POSITIONS_ERROR', 'Failed to retrieve positions')), 500);
  }
});

/**
 * Get Specific Position
 */
tradingRoutes.get('/positions/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const position = await alpaca.getPosition(symbol);
    
    if (!position) {
      throw new NotFoundError(`Position for ${symbol}`);
    }
    
    logger.info('Position retrieved', { symbol, quantity: position.quantity });
    return c.json(createApiResponse(position));
  } catch (error) {
    logger.error('Failed to get position', { symbol, error: (error as Error).message });
    
    if (error instanceof NotFoundError) {
      return c.json(createErrorResponse(createError(error.code, error.message)), 404);
    }
    
    return c.json(createErrorResponse(createError('POSITION_ERROR', 'Failed to retrieve position')), 500);
  }
});

/**
 * Submit New Order
 */
tradingRoutes.post('/orders', async (c) => {
  const logger = createLogger(c);
  
  try {
    const orderSchema = z.object({
      symbol: z.string().min(1).max(10),
      quantity: z.number().positive(),
      side: z.enum(['buy', 'sell']),
      orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']),
      timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).default('day'),
      limitPrice: z.number().positive().optional(),
      stopPrice: z.number().positive().optional(),
      clientOrderId: z.string().optional()
    });
    
    const orderRequest = validateRequest(orderSchema, await c.req.json());
    
    // Validate order combinations
    if (orderRequest.orderType === 'limit' && !orderRequest.limitPrice) {
      throw new ValidationError('Limit price required for limit orders');
    }
    if (orderRequest.orderType === 'stop' && !orderRequest.stopPrice) {
      throw new ValidationError('Stop price required for stop orders');
    }
    if (orderRequest.orderType === 'stop_limit' && (!orderRequest.limitPrice || !orderRequest.stopPrice)) {
      throw new ValidationError('Both limit and stop prices required for stop limit orders');
    }
    
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const order = await alpaca.submitOrder({
      symbol: orderRequest.symbol,
      qty: orderRequest.quantity,
      side: orderRequest.side as OrderSide,
      type: orderRequest.orderType as OrderType,
      time_in_force: orderRequest.timeInForce as TimeInForce || 'day',
      limit_price: orderRequest.limitPrice,
      stop_price: orderRequest.stopPrice,
      client_order_id: orderRequest.clientOrderId
    });
    
    logger.info('Order submitted', { 
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: (order as any).qty || order.quantity
    });
    
    return c.json(createApiResponse(order), 201);
  } catch (error) {
    logger.error('Failed to submit order', { error: (error as Error).message });
    
    if (error instanceof ValidationError) {
      return c.json(createErrorResponse(createError(error.code, error.message, error.details)), 400);
    }
    
    return c.json(createErrorResponse(createError('ORDER_ERROR', 'Failed to submit order')), 500);
  }
});

/**
 * Get Orders
 */
tradingRoutes.get('/orders', async (c) => {
  const logger = createLogger(c);
  
  try {
    const querySchema = z.object({
      status: z.enum(['open', 'closed', 'all']).optional(),
      limit: z.coerce.number().min(1).max(500).optional(),
      after: z.string().optional(),
      until: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional()
    });
    
    const query = validateRequest(querySchema, {
      status: c.req.query('status'),
      limit: c.req.query('limit'),
      after: c.req.query('after'),
      until: c.req.query('until'),
      direction: c.req.query('direction')
    });
    
    // Use AlpacaTradingService which accepts string literals
    const tradingService = new AlpacaTradingService(c.env, c.req.header('X-Tenant-ID') || 'default');
    
    const orders = await tradingService.getOrders(
      query.status as 'open' | 'closed' | 'all' | undefined,
      query.limit,
      query.after,
      query.until,
      query.direction
    );
    
    logger.info('Orders retrieved', { count: orders.length });
    return c.json(createApiResponse(orders));
  } catch (error) {
    logger.error('Failed to get orders', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('ORDERS_ERROR', 'Failed to retrieve orders')), 500);
  }
});

/**
 * Cancel Order
 */
tradingRoutes.delete('/orders/:orderId', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  const orderId = c.req.param('orderId');
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    await alpaca.cancelOrder(orderId);
    
    logger.info('Order cancelled', { orderId });
    return c.json(createApiResponse({ message: 'Order cancelled successfully' }));
  } catch (error) {
    logger.error('Failed to cancel order', { orderId, error: (error as Error).message });
    return c.json(createErrorResponse(createError('CANCEL_ERROR', 'Failed to cancel order')), 500);
  }
});

/**
 * Close Position
 */
tradingRoutes.delete('/positions/:symbol', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const order = await alpaca.closePosition(symbol);
    
    logger.info('Position closed', { symbol, orderId: order.id });
    return c.json(createApiResponse(order));
  } catch (error) {
    logger.error('Failed to close position', { symbol, error: (error as Error).message });
    return c.json(createErrorResponse(createError('CLOSE_POSITION_ERROR', 'Failed to close position')), 500);
  }
});

/**
 * Close All Positions
 */
tradingRoutes.delete('/positions', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const result = await alpaca.closeAllPositions();
    
    logger.info('All positions closed', { count: result.length });
    return c.json(createApiResponse(result));
  } catch (error) {
    logger.error('Failed to close all positions', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('CLOSE_ALL_ERROR', 'Failed to close all positions')), 500);
  }
});

/**
 * Get Real-time Quotes
 */
tradingRoutes.get('/market/quotes/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const {marketData} = alpaca;
    const quote = await marketData.getLatestQuote(symbol);
    
    logger.info('Quote retrieved', { symbol, bid: quote.bid_price, ask: quote.ask_price });
    return c.json(createApiResponse(quote));
  } catch (error) {
    logger.error('Failed to get quote', { symbol, error: (error as Error).message });
    return c.json(createErrorResponse(createError('QUOTE_ERROR', 'Failed to retrieve quote')), 500);
  }
});

/**
 * Get Bars (Historical Data)
 */
tradingRoutes.get('/market/bars/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const querySchema = z.object({
      timeframe: z.enum(['1Min', '5Min', '15Min', '30Min', '1Hour', '1Day']).default('1Day'),
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.coerce.number().min(1).max(10000).optional()
    });
    
    const query = validateRequest(querySchema, {
      timeframe: c.req.query('timeframe'),
      start: c.req.query('start'),
      end: c.req.query('end'),
      limit: c.req.query('limit')
    });
    
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const {marketData} = alpaca;
    const result = await marketData.getBars(symbol, query);
    
    logger.info('Bars retrieved', { symbol, count: result.bars.length });
    return c.json(createApiResponse(result.bars));
  } catch (error) {
    logger.error('Failed to get bars', { symbol, error: (error as Error).message });
    return c.json(createErrorResponse(createError('BARS_ERROR', 'Failed to retrieve bars')), 500);
  }
});

/**
 * Get Option Chains
 */
tradingRoutes.get('/options/chains/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const querySchema = z.object({
      expiration_date_gte: z.string().optional(),
      expiration_date_lte: z.string().optional(),
      strike_price_gte: z.coerce.number().optional(),
      strike_price_lte: z.coerce.number().optional(),
      type: z.enum(['call', 'put']).optional(),
      limit: z.coerce.number().min(1).max(10000).default(100)
    });
    
    const query = validateRequest(querySchema, {
      expiration_date_gte: c.req.query('expiration_date_gte'),
      expiration_date_lte: c.req.query('expiration_date_lte'),
      strike_price_gte: c.req.query('strike_price_gte'),
      strike_price_lte: c.req.query('strike_price_lte'),
      type: c.req.query('type'),
      limit: c.req.query('limit')
    });
    
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const options = await alpaca.getOptionContracts({
      underlyingSymbol: symbol,
      ...query
    });
    
    logger.info('Option contracts retrieved', { symbol, count: options.length });
    return c.json(createApiResponse(options));
  } catch (error) {
    logger.error('Failed to get option contracts', { symbol, error: (error as Error).message });
    return c.json(createErrorResponse(createError('OPTIONS_ERROR', 'Failed to retrieve option contracts')), 500);
  }
});

/**
 * Get Market Clock
 */
tradingRoutes.get('/clock', async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const clock = await alpaca.getClock();
    
    logger.info('Market clock retrieved', { isOpen: clock.isOpen });
    return c.json(createApiResponse(clock));
  } catch (error) {
    logger.error('Failed to get market clock', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('CLOCK_ERROR', 'Failed to retrieve market clock')), 500);
  }
});

/**
 * Get Market Hours
 */
tradingRoutes.get('/market-hours', async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const calendar = await alpaca.getCalendar({
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
    
    logger.info('Market hours retrieved', { date: new Date().toISOString().split('T')[0] });
    return c.json(createApiResponse(calendar[0] || null));
  } catch (error) {
    logger.error('Failed to get market hours', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('MARKET_HOURS_ERROR', 'Failed to retrieve market hours')), 500);
  }
});

/**
 * Get Trading Status
 */
tradingRoutes.get('/status', async (c) => {
  const logger = createLogger(c);
  
  try {
    // Get account status
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const account = await alpaca.getAccount();
    const clock = await alpaca.getClock();
    
    // Check if trading is enabled (from KV)
    const tradingEnabled = await c.env.CACHE.get('trading:enabled', 'json') as { enabled: boolean } | null;
    
    const status = {
      tradingEnabled: tradingEnabled?.enabled ?? false,
      marketOpen: clock.isOpen,
      accountStatus: (account as any).status || 'active',
      accountBlocked: account.accountBlocked || false,
      tradingBlocked: account.tradingBlocked || false,
      patternDayTrader: account.patternDayTrader || false,
      daytradeCount: account.daytradeCount || 0,
      buyingPower: account.buyingPower || '0',
      cash: account.cash || '0',
      portfolioValue: account.portfolioValue || '0'
    };
    
    logger.info('Trading status retrieved', status);
    return c.json(createApiResponse(status));
  } catch (error) {
    logger.error('Failed to get trading status', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('STATUS_ERROR', 'Failed to retrieve trading status')), 500);
  }
});

/**
 * Get Market Status
 */
tradingRoutes.get('/market/status', async (c) => {
  const logger = createLogger(c);
  
  try {
    const alpaca = new AlpacaClient(c.env, c.req.header('X-Tenant-ID') || 'default');
    const clock = await alpaca.getClock();
    
    logger.info('Market status retrieved', { isOpen: clock.isOpen });
    return c.json(createApiResponse(clock));
  } catch (error) {
    logger.error('Failed to get market status', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('MARKET_STATUS_ERROR', 'Failed to retrieve market status')), 500);
  }
});