/**
 * ULTRA Trading Platform - Main Application Entry Point
 * Production-ready Cloudflare Workers application with Hono framework
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';

// Import our application modules
import type { ApiContext } from './types';
import { createApiRouter } from './api';
import { 
  requestMiddleware,
  loggingMiddleware,
  errorMiddleware,
  securityHeadersMiddleware,
  apiVersionMiddleware
} from './middleware';
import { TradingSession } from './durable-objects/TradingSession';

/**
 * Main Hono Application
 * Configured with comprehensive middleware stack and API routes
 */
const app = new Hono<ApiContext>();

/**
 * Global Middleware Stack
 * Applied to all requests in order
 */

// Security headers first
app.use('*', secureHeaders());
app.use('*', securityHeadersMiddleware);

// CORS for cross-origin requests
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://*.ultra-trading.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposeHeaders: ['X-Request-ID', 'X-Execution-Time'],
  maxAge: 86400,
  credentials: true
}));

// Request processing
app.use('*', requestMiddleware);
app.use('*', loggingMiddleware);
app.use('*', apiVersionMiddleware);

// Pretty JSON in development
app.use('*', prettyJSON());

// Built-in Hono logger
app.use('*', logger((message) => {
  console.log(JSON.stringify({
    level: 'info',
    message,
    timestamp: new Date().toISOString(),
    source: 'hono-logger'
  }));
}));

/**
 * Root Health Check Endpoint
 * Simple endpoint for load balancer health checks
 */
app.get('/', async (c) => c.json({
    success: true,
    data: {
      name: 'ULTRA Trading Platform',
      version: c.env.API_VERSION || '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(performance.now()),
      message: 'Welcome to ULTRA Trading Platform API'
    },
    meta: {
      request_id: c.get('requestId'),
      execution_time_ms: Math.round(performance.now() - (c.get('startTime') || 0))
    }
  }));

/**
 * Quick Health Check (no authentication required)
 */
app.get('/ping', async (c) => c.json({
    success: true,
    data: {
      message: 'pong',
      timestamp: new Date().toISOString()
    }
  }));

/**
 * Simple message endpoint for demo HTML page
 */
app.get('/message', async (c) => c.text('🚀 ULTRA Trading Platform is LIVE! Welcome to the future of trading.'));

/**
 * System Status Endpoint
 * Provides detailed system information
 */
app.get('/status', async (c) => {
  const environment = c.env.ENVIRONMENT || 'development';
  const version = c.env.API_VERSION || '1.0.0';
  
  return c.json({
    success: true,
    data: {
      service: 'ULTRA Trading Platform',
      version,
      environment,
      region: c.req.header('CF-RAY')?.split('-')[1] || 'unknown',
      datacenter: c.req.header('CF-RAY') || 'unknown',
      timestamp: new Date().toISOString(),
      features: {
        real_time_trading: true,
        ai_analysis: true,
        options_trading: true,
        crypto_trading: true,
        advanced_charting: true
      },
      limits: {
        api_requests_per_minute: 1000,
        orders_per_second: 10,
        backtest_concurrent_limit: 5
      }
    }
  });
});

/**
 * API Documentation Endpoint
 */
app.get('/docs', async (c) => c.json({
    success: true,
    data: {
      title: 'ULTRA Trading Platform API',
      version: c.env.API_VERSION || '1.0.0',
      description: 'Professional trading platform with AI-powered analysis and backtesting',
      endpoints: {
        authentication: {
          'POST /api/v1/auth/login': 'User authentication',
          'POST /api/v1/auth/logout': 'User logout'
        },
        strategies: {
          'GET /api/v1/strategies': 'List trading strategies',
          'POST /api/v1/strategies': 'Create new strategy'
        },
        market_data: {
          'GET /api/v1/market-data/price/:symbol': 'Get current price',
          'GET /api/v1/market-data/historical/:symbol': 'Get historical data'
        },
        backtesting: {
          'POST /api/v1/backtests': 'Run strategy backtest',
          'GET /api/v1/backtests/:id': 'Get backtest results'
        },
        ai_analysis: {
          'POST /api/v1/ai/analyze': 'AI-powered strategy analysis'
        }
      },
      websockets: {
        '/ws/trading': 'Real-time trading updates',
        '/ws/market-data': 'Live market data feeds'
      }
    }
  }));

/**
 * Mount API Routes
 * All API endpoints under /api/v1
 */
const apiRouter = createApiRouter();
app.route('/api/v1', apiRouter);


/**
 * Catch-all for undefined routes
 */
app.notFound((c) => c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      suggestion: 'Visit /docs for available endpoints'
    },
    meta: {
      request_id: c.get('requestId'),
      timestamp: new Date().toISOString()
    }
  }, 404));

/**
 * Global Error Handler
 * Must be applied last
 */
app.use('*', errorMiddleware);

/**
 * Error Handler for unhandled errors
 */
app.onError((err, c) => {
  console.error('Unhandled application error:', {
    error: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
    timestamp: new Date().toISOString()
  });

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    meta: {
      request_id: c.get('requestId') || 'unknown',
      timestamp: new Date().toISOString()
    }
  }, 500);
});

/**
 * Export Durable Object Classes
 * Required for Cloudflare Workers
 */
export { TradingSession };
export { AgentCoordinator } from './durable-objects/AgentCoordinator';

/**
 * Export the worker with both Hono app and WebSocket handler
 */
export default {
  async fetch(request: Request, env: ApiContext['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrades for /ws/* paths
    if (url.pathname.startsWith('/ws/')) {
      const [, , sessionId] = url.pathname.split('/');
      
      if (!sessionId) {
        return new Response('Missing session ID', { status: 400 });
      }
      
      // Check for WebSocket upgrade
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }
      
      // Get or create Durable Object instance
      const id = env.TRADING_SESSION.idFromName(sessionId);
      const tradingSession = env.TRADING_SESSION.get(id);
      
      // Forward the request to the Durable Object
      // Type assertion needed due to Cloudflare Workers type differences
      return tradingSession.fetch(request as any) as unknown as Response;
    }
    
    // All other requests go to Hono
    // Type assertion needed for Hono compatibility
    return app.fetch(request, env, ctx) as unknown as Response;
  },
  
  /**
   * Scheduled handler for cron triggers
   */
  async scheduled(event: ScheduledEvent, env: ApiContext['Bindings'], ctx: ExecutionContext): Promise<void> {
    // Import dynamically to avoid circular dependencies
    const { handleScheduled } = await import('./handlers/cron');
    
    // Handle the scheduled event
    await handleScheduled(
      {
        cron: event.cron,
        scheduledTime: event.scheduledTime
      },
      env,
      ctx
    );
  }
} satisfies ExportedHandler<ApiContext['Bindings']>;
