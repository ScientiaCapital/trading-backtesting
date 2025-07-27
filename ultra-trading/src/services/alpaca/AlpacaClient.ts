/**
 * ULTRA Trading Platform - Alpaca API Client
 * Core Alpaca API wrapper with authentication and request handling
 */

import type { CloudflareBindings } from '../../types';
import { AppError, retry, timeout } from '../../utils';

/**
 * Alpaca API Configuration
 */
export interface AlpacaConfig {
  apiKeyId: string;
  apiSecret?: string;
  baseUrl: string;
  dataUrl: string;
  streamUrl: string;
  isPaper: boolean;
}

/**
 * Alpaca API Request Options
 */
export interface AlpacaRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Alpaca API Response
 */
export interface AlpacaResponse<T = unknown> {
  data: T;
  headers: Headers;
  status: number;
}

/**
 * Rate Limit Information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Alpaca Client - Core API wrapper
 */
export class AlpacaClient {
  private config: AlpacaConfig;
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  private readonly logger;

  constructor(
    private readonly env: CloudflareBindings,
    private readonly requestId: string
  ) {
    // Initialize configuration
    this.config = this.initializeConfig();
    
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
   * Initialize Alpaca configuration
   */
  private initializeConfig(): AlpacaConfig {
    const apiKeyId = this.env.ALPACA_API_KEY;
    const apiSecret = this.env.ALPACA_API_SECRET;

    if (!apiKeyId) {
      throw new AppError(
        'ALPACA_CONFIG_ERROR',
        'Alpaca API key not configured',
        500
      );
    }

    const isPaper = this.env.ENVIRONMENT !== 'production';
    const baseUrl = isPaper 
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
    const dataUrl = isPaper
      ? 'https://data.alpaca.markets'
      : 'https://data.alpaca.markets';
    const streamUrl = isPaper
      ? 'wss://stream.data.alpaca.markets'
      : 'wss://stream.data.alpaca.markets';

    return {
      apiKeyId,
      apiSecret,
      baseUrl,
      dataUrl,
      streamUrl,
      isPaper
    };
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'APCA-API-KEY-ID': this.config.apiKeyId,
      'Content-Type': 'application/json'
    };
    
    // Add secret key if available
    if (this.config.apiSecret) {
      headers['APCA-API-SECRET-KEY'] = this.config.apiSecret;
    }
    
    return headers;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, queryParams?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint);
    
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Check and handle rate limits
   */
  private checkRateLimit(endpoint: string): void {
    const rateLimitInfo = this.rateLimitInfo.get(endpoint);
    
    if (rateLimitInfo && rateLimitInfo.remaining === 0) {
      const now = Date.now() / 1000;
      if (now < rateLimitInfo.reset) {
        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded. Reset at ${new Date(rateLimitInfo.reset * 1000).toISOString()}`,
          429,
          { endpoint, resetTime: rateLimitInfo.reset }
        );
      }
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimit(endpoint: string, headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo.set(endpoint, {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10)
      });
    }
  }

  /**
   * Make API request to Alpaca
   */
  async request<T>(
    endpoint: string,
    options: AlpacaRequestOptions = {}
  ): Promise<AlpacaResponse<T>> {
    const {
      method = 'GET',
      body,
      queryParams,
      headers = {},
      timeout: requestTimeout = 10000
    } = options;

    // Check rate limits
    this.checkRateLimit(endpoint);

    // Build full URL
    const url = this.buildUrl(endpoint, queryParams);

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        ...this.getAuthHeaders(),
        ...headers
      }
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    this.logger.debug('Making Alpaca API request', {
      url,
      method,
      hasBody: !!body
    });

    try {
      // Make request with retry logic
      const response = await retry(
        async () => {
          const res = await timeout(
            fetch(url, requestOptions),
            requestTimeout
          );

          // Update rate limit info
          this.updateRateLimit(endpoint, res.headers);

          // Handle non-200 responses
          if (!res.ok) {
            const errorBody = await res.text();
            let errorMessage = `Alpaca API error: ${res.status} ${res.statusText}`;
            
            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              // Use text error if not JSON
              errorMessage = errorBody || errorMessage;
            }

            // Handle specific error codes
            if (res.status === 429) {
              throw new AppError('RATE_LIMIT_EXCEEDED', errorMessage, 429);
            } else if (res.status === 401) {
              throw new AppError('AUTHENTICATION_ERROR', errorMessage, 401);
            } else if (res.status === 403) {
              throw new AppError('AUTHORIZATION_ERROR', errorMessage, 403);
            } else if (res.status === 404) {
              throw new AppError('NOT_FOUND', errorMessage, 404);
            } else if (res.status >= 500) {
              throw new AppError('ALPACA_SERVER_ERROR', errorMessage, res.status);
            } else {
              throw new AppError('ALPACA_API_ERROR', errorMessage, res.status);
            }
          }

          return res;
        },
        3, // Max attempts
        1000 // Initial delay
      );

      // Parse response
      const data = await response.json() as T;

      this.logger.info('Alpaca API request successful', {
        url,
        status: response.status
      });

      return {
        data,
        headers: response.headers,
        status: response.status
      };
    } catch (error) {
      this.logger.error('Alpaca API request failed', {
        url,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Make request to trading API
   */
  async tradingRequest<T>(
    path: string,
    options?: AlpacaRequestOptions
  ): Promise<T> {
    const endpoint = `${this.config.baseUrl}${path}`;
    const response = await this.request<T>(endpoint, options);
    return response.data;
  }

  /**
   * Make request to market data API
   */
  async dataRequest<T>(
    path: string,
    options?: AlpacaRequestOptions
  ): Promise<T> {
    const endpoint = `${this.config.dataUrl}${path}`;
    const response = await this.request<T>(endpoint, options);
    return response.data;
  }

  /**
   * Get current configuration
   */
  getConfig(): AlpacaConfig {
    return { ...this.config };
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(endpoint: string): RateLimitInfo | undefined {
    return this.rateLimitInfo.get(endpoint);
  }

  /**
   * Check if using paper trading
   */
  isPaperTrading(): boolean {
    return this.config.isPaper;
  }
}