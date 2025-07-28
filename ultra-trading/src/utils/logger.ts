/**
 * Logger Utility
 * Simple logging wrapper for Cloudflare Workers
 */

export interface Logger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
}

export function createLogger(context?: any): Logger {
  const prefix = context?.name || 'APP';
  
  return {
    debug(message: string, data?: any): void {
      console.log(JSON.stringify({
        level: 'debug',
        prefix,
        message,
        data,
        timestamp: new Date().toISOString()
      }));
    },
    
    info(message: string, data?: any): void {
      console.log(JSON.stringify({
        level: 'info',
        prefix,
        message,
        data,
        timestamp: new Date().toISOString()
      }));
    },
    
    warn(message: string, data?: any): void {
      console.warn(JSON.stringify({
        level: 'warn',
        prefix,
        message,
        data,
        timestamp: new Date().toISOString()
      }));
    },
    
    error(message: string, data?: any): void {
      console.error(JSON.stringify({
        level: 'error',
        prefix,
        message,
        data,
        timestamp: new Date().toISOString()
      }));
    }
  };
}