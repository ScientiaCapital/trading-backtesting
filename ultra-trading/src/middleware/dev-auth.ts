/**
 * Development Authentication Bypass
 * ONLY FOR LOCAL DEVELOPMENT - DO NOT DEPLOY TO PRODUCTION
 */

import type { Next } from 'hono';
import type { HonoContext } from '../types';

export const devAuthMiddleware = async (c: HonoContext, next: Next): Promise<Response | void> => {
  // In development, bypass auth and set default user
  if (c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === undefined) {
    c.set('userId', 'dev-user');
    c.set('tenantId', 'default');
    console.log('Dev auth bypass - User: dev-user, Tenant: default');
    await next();
    return;
  }
  
  // In production, fall back to real auth
  throw new Error('Dev auth middleware should not be used in production');
};