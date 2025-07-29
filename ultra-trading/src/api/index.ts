/**
 * ULTRA Trading Platform - API Routes
 * RESTful API endpoints for the trading platform
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { 
  ApiContext,
  BacktestRequest,
  AIAnalysisRequest
} from '../types';
import { 
  DatabaseService,
  MarketDataService,
  BacktestService,
  AIService,
  HealthService
} from '../services';
import { 
  validateRequest,
  createApiResponse,
  createErrorResponse,
  createError,
  AppError,
  NotFoundError,
  ValidationError,
  createLogger
} from '../utils';
import {
  authMiddleware,
  rateLimitMiddleware,
  requireRole,
  tenantIsolationMiddleware
} from '../middleware';

/**
 * Health Check Routes
 */
export const healthRoutes = new Hono<ApiContext>();

// Basic ping endpoint
healthRoutes.get('/ping', async (c) => c.json({
    success: true,
    data: {
      message: 'pong',
      timestamp: new Date().toISOString()
    }
  }));

// Comprehensive health check
healthRoutes.get('/health', async (c) => {
  const healthService = new HealthService(c);
  const status = await healthService.getHealthStatus();
  
  const httpStatus = status.status === 'healthy' ? 200 : 
                    status.status === 'degraded' ? 200 : 503;
  
  return c.json(createApiResponse(status), httpStatus);
});

/**
 * Authentication Routes
 */
export const authRoutes = new Hono<ApiContext>();

// Login endpoint
authRoutes.post('/login', async (c) => {
  const logger = createLogger(c);
  
  try {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8)
    });
    
    const { email, password } = validateRequest(loginSchema, await c.req.json());
    
    // Placeholder authentication logic
    // In production, verify against secure password hash
    if (email && password) {
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      // Store session in KV
      await c.env.CACHE.put(
        `session:${sessionToken}`,
        JSON.stringify({
          user_id: 'user-123', // Would be actual user ID
          tenant_id: 'tenant-123',
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }),
        { expirationTtl: 24 * 60 * 60 } // 24 hours
      );
      
      logger.info('User logged in', { email });
      
      return c.json(createApiResponse({
        token: sessionToken,
        expires_at: expiresAt,
        user: {
          id: 'user-123',
          email,
          name: 'Demo User',
          role: 'trader'
        }
      }));
    }
    
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    
  } catch (error) {
    const logger = createLogger(c);
    logger.error('Login failed', { error: (error as Error).message });
    
    if (error instanceof AppError) {
      return c.json(createErrorResponse(createError(error.code, error.message)), error.statusCode as 401);
    }
    
    return c.json(createErrorResponse(createError('LOGIN_ERROR', 'Login failed')), 500 as const);
  }
});

// Logout endpoint
authRoutes.post('/logout', authMiddleware, async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.slice(7); // Remove 'Bearer '
  
  if (token) {
    await c.env.CACHE.delete(`session:${token}`);
  }
  
  return c.json(createApiResponse({ message: 'Logged out successfully' }));
});

/**
 * Strategy Routes
 */
export const strategyRoutes = new Hono<ApiContext>();

// Apply middleware to all strategy routes
strategyRoutes.use('*', authMiddleware);
strategyRoutes.use('*', tenantIsolationMiddleware);
strategyRoutes.use('*', rateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }));

// Get strategies
strategyRoutes.get('/', async (c) => {
  const logger = createLogger(c);
  const tenantId = c.get('tenantId') ?? '';
  
  try {
    const db = new DatabaseService(c);
    const strategies = await db.getStrategiesByTenant(tenantId);
    
    logger.info('Strategies retrieved', { count: strategies.length });
    return c.json(createApiResponse(strategies));
    
  } catch (error) {
    logger.error('Failed to get strategies', { error: (error as Error).message });
    return c.json(createErrorResponse(createError('DATABASE_ERROR', 'Failed to retrieve strategies')), 500 as const);
  }
});

// Create strategy
strategyRoutes.post('/', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  
  try {
    const strategySchema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500),
      type: z.enum(['mean_reversion', 'momentum', 'pairs_trading', 'options_gamma_scalping', 'crypto_arbitrage', 'custom']),
      parameters: z.record(z.unknown()),
      enabled: z.boolean().default(false)
    });
    
    const strategyData = validateRequest(strategySchema, await c.req.json());
    
    // Ensure enabled is always a boolean
    const strategyDataWithDefaults = {
      ...strategyData,
      enabled: strategyData.enabled ?? false
    };
    
    const db = new DatabaseService(c);
    const strategy = await db.createStrategy(strategyDataWithDefaults);
    
    logger.info('Strategy created', { strategyId: strategy.id, name: strategy.name });
    return c.json(createApiResponse(strategy), 201);
    
  } catch (error) {
    logger.error('Failed to create strategy', { error: (error as Error).message });
    
    if (error instanceof ValidationError) {
      return c.json(createErrorResponse(createError(error.code, error.message, error.details)), 400 as const);
    }
    
    return c.json(createErrorResponse(createError('STRATEGY_CREATE_ERROR', 'Failed to create strategy')), 500 as const);
  }
});

/**
 * Market Data Routes
 */
export const marketDataRoutes = new Hono<ApiContext>();

marketDataRoutes.use('*', authMiddleware);
marketDataRoutes.use('*', rateLimitMiddleware({ windowMs: 60000, maxRequests: 200 }));

// Get current price
marketDataRoutes.get('/price/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const symbolSchema = z.string().min(1).max(10);
    validateRequest(symbolSchema, symbol);
    
    const marketDataService = new MarketDataService(c);
    const price = await marketDataService.getCurrentPrice(symbol);
    
    if (!price) {
      throw new NotFoundError(`Price data for ${symbol}`);
    }
    
    return c.json(createApiResponse(price));
    
  } catch (error) {
    logger.error('Failed to get price', { symbol, error: (error as Error).message });
    
    if (error instanceof NotFoundError) {
      return c.json(createErrorResponse(createError(error.code, error.message)), 404 as const);
    }
    
    return c.json(createErrorResponse(createError('PRICE_ERROR', 'Failed to retrieve price')), 500 as const);
  }
});

// Get historical data
marketDataRoutes.get('/historical/:symbol', async (c) => {
  const logger = createLogger(c);
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const querySchema = z.object({
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      timeframe: z.string().default('1D')
    });
    
    const query = validateRequest(querySchema, {
      start_date: c.req.query('start_date'),
      end_date: c.req.query('end_date'),
      timeframe: c.req.query('timeframe')
    });
    
    const marketDataService = new MarketDataService(c);
    const data = await marketDataService.getHistoricalData(
      symbol,
      query.start_date,
      query.end_date,
      query.timeframe
    );
    
    return c.json(createApiResponse(data));
    
  } catch (error) {
    logger.error('Failed to get historical data', { symbol, error: (error as Error).message });
    
    if (error instanceof ValidationError) {
      return c.json(createErrorResponse(createError(error.code, error.message, error.details)), 400 as const);
    }
    
    return c.json(createErrorResponse(createError('HISTORICAL_DATA_ERROR', 'Failed to retrieve historical data')), 500 as const);
  }
});

/**
 * Backtest Routes
 */
export const backtestRoutes = new Hono<ApiContext>();

backtestRoutes.use('*', authMiddleware);
backtestRoutes.use('*', tenantIsolationMiddleware);
backtestRoutes.use('*', rateLimitMiddleware({ windowMs: 300000, maxRequests: 10 })); // 10 backtests per 5 minutes

// Run backtest
backtestRoutes.post('/', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  
  try {
    const backtestSchema = z.object({
      strategy_id: z.string().uuid(),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      initial_capital: z.number().positive(),
      symbols: z.array(z.string()).min(1),
      benchmark: z.string().optional()
    });
    
    const requestData = validateRequest(backtestSchema, await c.req.json());
    
    // Get strategy details
    // In a real implementation, we'd fetch the strategy from the database
    
    const backtestRequest: BacktestRequest = {
      strategy: {
        id: requestData.strategy_id,
        name: 'Demo Strategy',
        description: 'Demo strategy for backtesting',
        type: 'momentum',
        parameters: {},
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      start_date: requestData.start_date,
      end_date: requestData.end_date,
      initial_capital: requestData.initial_capital,
      symbols: requestData.symbols,
      benchmark: requestData.benchmark
    };
    
    const backtestService = new BacktestService(c);
    const result = await backtestService.runBacktest(backtestRequest);
    
    logger.info('Backtest completed', { 
      backtestId: result.id, 
      totalReturn: result.total_return 
    });
    
    return c.json(createApiResponse(result), 201);
    
  } catch (error) {
    logger.error('Backtest failed', { error: (error as Error).message });
    
    if (error instanceof ValidationError) {
      return c.json(createErrorResponse(createError(error.code, error.message, error.details)), 400 as const);
    }
    
    return c.json(createErrorResponse(createError('BACKTEST_ERROR', 'Failed to run backtest')), 500 as const);
  }
});

// Get backtest result
backtestRoutes.get('/:id', async (c) => {
  const logger = createLogger(c);
  const id = c.req.param('id');
  
  try {
    const backtestService = new BacktestService(c);
    const result = await backtestService.getBacktestResult(id);
    
    if (!result) {
      throw new NotFoundError('Backtest result');
    }
    
    return c.json(createApiResponse(result));
    
  } catch (error) {
    logger.error('Failed to get backtest result', { id, error: (error as Error).message });
    
    if (error instanceof NotFoundError) {
      return c.json(createErrorResponse(createError(error.code, error.message)), 404 as const);
    }
    
    return c.json(createErrorResponse(createError('BACKTEST_GET_ERROR', 'Failed to retrieve backtest result')), 500 as const);
  }
});

/**
 * AI Analysis Routes
 */
export const aiRoutes = new Hono<ApiContext>();

aiRoutes.use('*', authMiddleware);
aiRoutes.use('*', tenantIsolationMiddleware);
aiRoutes.use('*', rateLimitMiddleware({ windowMs: 60000, maxRequests: 20 })); // 20 AI requests per minute

// Analyze strategy
aiRoutes.post('/analyze', requireRole(['admin', 'trader']), async (c) => {
  const logger = createLogger(c);
  
  try {
    const analysisSchema = z.object({
      type: z.enum(['strategy_optimization', 'market_analysis', 'risk_assessment']),
      data: z.record(z.unknown()),
      model_preference: z.enum(['claude', 'gemini', 'auto']).optional()
    });
    
    const request = validateRequest(analysisSchema, await c.req.json()) as AIAnalysisRequest;
    
    const aiService = new AIService(c);
    const result = await aiService.analyzeStrategy(request);
    
    logger.info('AI analysis completed', { 
      type: request.type,
      modelUsed: result.model_used,
      executionTime: result.execution_time_ms 
    });
    
    return c.json(createApiResponse(result));
    
  } catch (error) {
    logger.error('AI analysis failed', { error: (error as Error).message });
    
    if (error instanceof ValidationError) {
      return c.json(createErrorResponse(createError(error.code, error.message, error.details)), 400 as const);
    }
    
    return c.json(createErrorResponse(createError('AI_ANALYSIS_ERROR', 'Failed to analyze strategy')), 500 as const);
  }
});

/**
 * Trading Routes - Import
 */
import { tradingRoutes } from './trading';

/**
 * Real-time Routes - Import
 */
import realtimeRoutes from './realtime';

/**
 * Agent Routes - Import
 */
import { agentRoutes } from './agents';

/**
 * Market Time Routes - Import
 */
import { marketTimeRoutes } from './market-time';

/**
 * Root API Router
 * Combines all route modules
 */
export const createApiRouter = (): Hono<ApiContext> => {
  const api = new Hono<ApiContext>();
  
  // Mount route modules
  api.route('/health', healthRoutes);
  api.route('/auth', authRoutes);
  api.route('/strategies', strategyRoutes);
  api.route('/market-data', marketDataRoutes);
  api.route('/backtests', backtestRoutes);
  api.route('/ai', aiRoutes);
  api.route('/trading', tradingRoutes);
  api.route('/realtime', realtimeRoutes);
  api.route('/agents', agentRoutes);
  api.route('/market-time', marketTimeRoutes);
  
  return api;
};