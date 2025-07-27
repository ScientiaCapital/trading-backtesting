/**
 * ULTRA Trading Platform - Middleware Functions
 * Authentication, logging, rate limiting, and request processing middleware
 */

import type { Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { createLogger, generateRequestId, AppError, AuthenticationError, RateLimitError } from '../utils';
import type { HonoContext, User, AuthSession } from '../types';

/**
 * Request ID and Timing Middleware
 * Adds unique request ID and tracks execution time
 */
export const requestMiddleware = async (c: HonoContext, next: Next): Promise<void> => {
  const requestId = generateRequestId();
  const startTime = performance.now();
  
  c.set('requestId', requestId);
  c.set('startTime', startTime);
  
  // Set request ID header for client tracking
  c.header('X-Request-ID', requestId);
  
  await next();
  
  // Add execution time header
  const executionTime = Math.round(performance.now() - startTime);
  c.header('X-Execution-Time', `${executionTime}ms`);
};

/**
 * Logging Middleware
 * Comprehensive request and response logging
 */
export const loggingMiddleware = async (c: HonoContext, next: Next): Promise<void> => {
  const logger = createLogger(c);
  const startTime = performance.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: c.req.method,
    url: c.req.url,
    userAgent: c.req.header('User-Agent'),
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    country: c.req.header('CF-IPCountry')
  });
  
  try {
    await next();
    
    const executionTime = Math.round(performance.now() - startTime);
    
    // Log successful response
    logger.info('Request completed', {
      status: c.res.status,
      executionTimeMs: executionTime
    });
    
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    
    // Log error
    logger.error('Request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime
    });
    
    throw error;
  }
};

/**
 * CORS Middleware
 * Handle cross-origin requests with proper headers
 */
export const corsMiddleware = async (c: HonoContext, next: Next): Promise<Response | void> => {
  // Set CORS headers
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  c.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.newResponse('', 204);
  }
  
  await next();
};

/**
 * Authentication Middleware
 * Validates user session and sets user context
 */
export const authMiddleware = async (c: HonoContext, next: Next): Promise<Response | void> => {
  const logger = createLogger(c);
  
  try {
    // Extract token from Authorization header or cookie
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7)
      : getCookie(c, 'auth_token');
    
    if (!token) {
      throw new AuthenticationError('Authentication token required');
    }
    
    // Validate session from KV store
    const sessionKey = `session:${token}`;
    const sessionData = await c.env.CACHE.get(sessionKey);
    
    if (!sessionData) {
      throw new AuthenticationError('Invalid or expired session');
    }
    
    const session: AuthSession = JSON.parse(sessionData);
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await c.env.CACHE.delete(sessionKey);
      throw new AuthenticationError('Session expired');
    }
    
    // Get user details from database
    const userQuery = await c.env.DB
      .prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?')
      .bind(session.user_id, session.tenant_id)
      .first<User>();
    
    if (!userQuery) {
      throw new AuthenticationError('User not found');
    }
    
    // Set user context
    c.set('userId', session.user_id);
    c.set('tenantId', session.tenant_id);
    
    logger.info('User authenticated', {
      userId: session.user_id,
      tenantId: session.tenant_id
    });
    
    await next();
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return c.json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }, error.statusCode as 401);
    }
    throw error;
  }
};

/**
 * Optional Authentication Middleware
 * Sets user context if authenticated, but doesn't require it
 */
export const optionalAuthMiddleware = async (c: HonoContext, next: Next): Promise<void> => {
  try {
    await authMiddleware(c, async () => {});
  } catch {
    // Ignore authentication errors for optional auth
  }
  
  await next();
};

/**
 * Rate Limiting Middleware
 * Implements per-user and per-IP rate limiting
 */
export const rateLimitMiddleware = (options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (_c: HonoContext) => string;
}) => async (c: HonoContext, next: Next): Promise<void> => {
    const { windowMs, maxRequests, keyGenerator } = options;
    
    // Generate rate limit key
    const defaultKeyGenerator = (context: HonoContext): string => {
      const userId = context.get('userId');
      const ip = context.req.header('CF-Connecting-IP') || context.req.header('X-Forwarded-For') || 'unknown';
      return userId ? `user:${userId}` : `ip:${ip}`;
    };
    
    const key = keyGenerator ? keyGenerator(c) : defaultKeyGenerator(c);
    const rateLimitKey = `rate_limit:${key}:${Math.floor(Date.now() / windowMs)}`;
    
    // Get current request count
    const currentCount = await c.env.CACHE.get(rateLimitKey);
    const requestCount = currentCount ? parseInt(currentCount) : 0;
    
    if (requestCount >= maxRequests) {
      throw new RateLimitError(`Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs}ms.`);
    }
    
    // Increment request count
    await c.env.CACHE.put(
      rateLimitKey,
      String(requestCount + 1),
      { expirationTtl: Math.ceil(windowMs / 1000) }
    );
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - requestCount - 1));
    c.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / windowMs) * windowMs));
    
    await next();
  };

/**
 * Role-based Authorization Middleware
 * Ensures user has required role/permissions
 */
export const requireRole = (allowedRoles: string[]) => async (c: HonoContext, next: Next): Promise<Response | void> => {
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    
    if (!userId || !tenantId) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Get user role from database
    const userQuery = await c.env.DB
      .prepare('SELECT role FROM users WHERE id = ? AND tenant_id = ?')
      .bind(userId, tenantId)
      .first<{ role: string }>();
    
    if (!userQuery || !allowedRoles.includes(userQuery.role)) {
      return c.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation'
        }
      }, 403 as 403);
    }
    
    await next();
  };

/**
 * Tenant Isolation Middleware
 * Ensures data access is restricted to user's tenant
 */
export const tenantIsolationMiddleware = async (c: HonoContext, next: Next): Promise<Response | void> => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new AuthenticationError('Tenant context required');
  }
  
  // Validate tenant exists and is active
  const tenantQuery = await c.env.DB
    .prepare('SELECT id, name FROM organizations WHERE id = ?')
    .bind(tenantId)
    .first<{ id: string; name: string }>();
  
  if (!tenantQuery) {
    return c.json({
      success: false,
      error: {
        code: 'INVALID_TENANT',
        message: 'Invalid tenant'
      }
    }, 403 as 403);
  }
  
  await next();
};

/**
 * Error Handling Middleware
 * Global error handler with proper error responses
 */
export const errorMiddleware = async (c: HonoContext, next: Next): Promise<Response | void> => {
  const logger = createLogger(c);
  
  try {
    await next();
  } catch (error) {
    logger.error('Unhandled error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error instanceof AppError) {
      return c.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        meta: {
          request_id: c.get('requestId'),
          timestamp: new Date().toISOString()
        }
      }, error.statusCode as 500);
    }
    
    // Generic error response
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    }, 500 as 500);
  }
};

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */
export const securityHeadersMiddleware = async (c: HonoContext, next: Next): Promise<void> => {
  await next();
  
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  
  // Remove server identification
  c.header('Server', 'ULTRA-Trading');
};

/**
 * Health Check Bypass Middleware
 * Allows health checks to bypass authentication
 */
export const healthCheckBypass = (healthCheckPaths: string[] = ['/health', '/ping']) => async (c: HonoContext, next: Next): Promise<void> => {
    const path = new URL(c.req.url).pathname;
    
    if (healthCheckPaths.includes(path)) {
      // Skip authentication for health checks
      await next();
      return;
    }
    
    // Apply normal authentication
    await authMiddleware(c, next);
  };

/**
 * Cache Control Middleware
 * Sets appropriate cache headers based on route
 */
export const cacheControlMiddleware = (options: {
  maxAge?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
} = {}) => async (c: HonoContext, next: Next): Promise<void> => {
    await next();
    
    const { maxAge = 0, mustRevalidate = false, noCache = false } = options;
    
    if (noCache) {
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    } else {
      const cacheControl = [
        `max-age=${maxAge}`,
        mustRevalidate ? 'must-revalidate' : '',
        'public'
      ].filter(Boolean).join(', ');
      
      c.header('Cache-Control', cacheControl);
    }
  };

/**
 * API Versioning Middleware
 * Handles API version headers and routing
 */
export const apiVersionMiddleware = async (c: HonoContext, next: Next): Promise<void> => {
  const version = c.req.header('API-Version') || c.env.API_VERSION || 'v1';
  c.header('API-Version', version);
  
  await next();
};